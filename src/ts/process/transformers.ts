import type { PipelineType, SummarizationOutput, TextToAudioPipeline, FeatureExtractionPipeline, TextGenerationConfig, TextGenerationOutput, ImageToTextOutput, SummarizationPipeline, TextGenerationPipeline, ImageToTextPipeline } from '@huggingface/transformers'
import { unzip, type Unzipped } from 'fflate'
import { loadAsset, saveAsset } from 'src/ts/globalApi.svelte'
import { asBuffer } from 'src/ts/util'
import { v4 } from 'uuid'

let audioContext: AudioContext | null = null
function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext()
    }
    return audioContext
}

let initPromise: Promise<void> | null = null
const tfMap: { [key: string]: string } = {}

function initTransformers(): Promise<void> {
    if (initPromise === null) {
        initPromise = doInitTransformers()
    }
    return initPromise
}

async function doInitTransformers(): Promise<void> {
    const { env } = await import('@huggingface/transformers')
    const tfCache = await caches.open('tfCache')
    env.localModelPath = "https://sv.risuai.xyz/transformers/"
    env.useBrowserCache = false
    env.useFSCache = false
    env.useCustomCache = true
    env.allowLocalModels = true
    env.customCache = {
        put: async (url: URL | string, response: Response) => {
            await tfCache.put(url, response)
        },
        match: async (url: URL | string) => {
            if (typeof url === 'string') {
                if (url in tfMap) {
                    const assetId = tfMap[url]
                    return new Response(asBuffer(await loadAsset(assetId)))
                }
            }
            return await tfCache.match(url)
        }
    }
}

interface Disposable {
    dispose?: () => Promise<void>
}

type DType = 'auto' | 'fp32' | 'fp16' | 'q8' | 'int8' | 'uint8' | 'q4' | 'bnb4' | 'q4f16'

interface PipelineOptions {
    device?: 'webgpu' | 'wasm'
    dtype?: DType
    [key: string]: unknown
}

class PipelineManager {
    private pipelines = new Map<PipelineType, { instance: Disposable; cacheKey: string }>()

    async get<T>(
        task: PipelineType,
        model: string,
        options?: PipelineOptions
    ): Promise<T> {
        const cacheKey = this.buildCacheKey(model, options)
        const existing = this.pipelines.get(task)

        if (existing && existing.cacheKey === cacheKey) {
            return existing.instance as T
        }

        if (existing) {
            await existing.instance.dispose?.()
        }

        await initTransformers()
        const { pipeline } = await import('@huggingface/transformers')
        const instance = await pipeline(task, model, options)

        this.pipelines.set(task, { instance, cacheKey })
        return instance as T
    }

    async dispose(task: PipelineType): Promise<void> {
        const entry = this.pipelines.get(task)
        if (entry) {
            await entry.instance.dispose?.()
            this.pipelines.delete(task)
        }
    }

    async disposeAll(): Promise<void> {
        for (const [, entry] of this.pipelines) {
            await entry.instance.dispose?.()
        }
        this.pipelines.clear()
    }

    private buildCacheKey(model: string, options?: PipelineOptions): string {
        const keyParts = [model]
        if (options?.device) keyParts.push(options.device)
        if (options?.dtype) keyParts.push(options.dtype)
        return keyParts.join(':')
    }
}

const pipelineManager = new PipelineManager()

export const runTransformers = async (baseText: string, model: string, config: TextGenerationConfig, device: 'webgpu' | 'wasm' = 'wasm') => {
    const generator = await pipelineManager.get<TextGenerationPipeline>(
        'text-generation',
        model,
        { device }
    )

    const output = await generator(baseText, config) as TextGenerationOutput
    return output[0]
}

export const runSummarizer = async (text: string) => {
    const classifier = await pipelineManager.get<SummarizationPipeline>(
        'summarization',
        'Xenova/distilbart-cnn-6-6'
    )

    const v = await classifier(text) as SummarizationOutput
    return v[0].summary_text
}

type EmbeddingModel = 'Xenova/all-MiniLM-L6-v2' | 'nomic-ai/nomic-embed-text-v1.5'
export const runEmbedding = async (texts: string[], model: EmbeddingModel = 'Xenova/all-MiniLM-L6-v2', device: 'webgpu' | 'wasm'): Promise<Float32Array[]> => {
    const extractor = await pipelineManager.get<FeatureExtractionPipeline>(
        'feature-extraction',
        model,
        {
            dtype: "q8",
            device
        }
    )

    const result = await extractor(texts, { pooling: 'mean', normalize: true })
    const data = result.data as Float32Array
    const lenPerText = data.length / texts.length
    const res: Float32Array[] = []
    for (let i = 0; i < texts.length; i++) {
        res.push(data.subarray(i * lenPerText, (i + 1) * lenPerText))
    }
    return res
}

export const runImageEmbedding = async (dataurl: string) => {
    const captioner = await pipelineManager.get<ImageToTextPipeline>(
        'image-to-text',
        'Xenova/vit-gpt2-image-captioning'
    )

    return await captioner(dataurl) as ImageToTextOutput
}

let synthesizer: TextToAudioPipeline | null = null
let lastSynth: string | null = null

export interface OnnxModelFiles {
    files: { [key: string]: string },
    id: string,
    name?: string
}

export const runVITS = async (text: string, modelData: string | OnnxModelFiles = 'Xenova/mms-tts-eng') => {
    await initTransformers()
    const { WaveFile } = await import('wavefile')
    const { pipeline, env } = await import('@huggingface/transformers')

    if (typeof modelData === 'string') {
        if ((!synthesizer) || (lastSynth !== modelData)) {
            await synthesizer?.dispose()
            lastSynth = modelData
            synthesizer = await pipeline<"text-to-speech">('text-to-speech', modelData)
        }
    }
    else {
        if ((!synthesizer) || (lastSynth !== modelData.id)) {
            await synthesizer?.dispose()
            const files = modelData.files
            const keys = Object.keys(files)
            for (const key of keys) {
                const fileURL = env.localModelPath + modelData.id + '/' + key
                tfMap[fileURL] = files[key]
                tfMap[location.origin + fileURL] = files[key]
            }
            lastSynth = modelData.id
            synthesizer = await pipeline<"text-to-speech">('text-to-speech', modelData.id)
        }
    }
    const out = await synthesizer(text, {})
    const wav = new WaveFile()
    wav.fromScratch(1, out.sampling_rate, '32f', out.audio)

    const ctx = getAudioContext()
    if (ctx.state === 'suspended') {
        await ctx.resume()
    }
    const decodedData = await ctx.decodeAudioData(asBuffer(wav.toBuffer().buffer))
    const sourceNode = ctx.createBufferSource()
    sourceNode.buffer = decodedData
    sourceNode.connect(ctx.destination)
    sourceNode.start()
}

export const registerOnnxModel = async (fileData: Uint8Array, fileName: string): Promise<OnnxModelFiles> => {
    const id = v4().replace(/-/g, '')

    const unzipped = await new Promise<Unzipped>((res, rej) => {
        unzip(fileData, {
            filter: (file) => {
                return file.name.endsWith('.onnx') || file.size < 10_000_000 || file.name.includes('.git')
            }
        }, (err, unzipped) => {
            if (err) {
                rej(err)
            }
            else {
                res(unzipped)
            }
        })
    })

    const fileIdMapped: { [key: string]: string } = {}

    const keys = Object.keys(unzipped)
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i]
        const file = unzipped[key]
        const fid = await saveAsset(file)
        let url = key
        if (url.startsWith('/')) {
            url = url.substring(1)
        }
        fileIdMapped[url] = fid
    }

    return {
        files: fileIdMapped,
        name: fileName,
        id: id,
    }

}
