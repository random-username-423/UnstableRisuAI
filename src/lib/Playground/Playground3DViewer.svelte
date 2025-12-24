<script lang="ts">
    import { onMount, onDestroy } from "svelte"
    import Button from "../UI/GUI/Button.svelte"
    import { language } from "src/lang"

    let container: HTMLDivElement
    let canvas: HTMLCanvasElement
    let fileInput: HTMLInputElement
    let loaded = $state(false)
    let loading = $state(false)
    let error = $state("")
    let modelName = $state("")
    let textureCount = $state(0)

    let scene: any
    let camera: any
    let renderer: any
    let controls: any
    let animationId: number
    let currentModel: any
    let textureMap: Map<string, string> = new Map()

    async function initThree() {
        if (!canvas) return

        const THREE = await import("three")
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js")

        scene = new THREE.Scene()
        scene.background = new THREE.Color(0x1a1a2e)

        const width = container.clientWidth
        const height = 500

        camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000)
        camera.position.set(0, 100, 200)

        renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
        renderer.setSize(width, height)
        renderer.setPixelRatio(window.devicePixelRatio)

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
        scene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(100, 200, 100)
        scene.add(directionalLight)

        // Grid helper
        const gridHelper = new THREE.GridHelper(400, 40, 0x444444, 0x333333)
        scene.add(gridHelper)

        // Controls
        controls = new OrbitControls(camera, renderer.domElement)
        controls.enableDamping = true
        controls.dampingFactor = 0.05

        animate()
    }

    function animate() {
        animationId = requestAnimationFrame(animate)
        controls?.update()
        renderer?.render(scene, camera)
    }

    function cleanupTextureMap() {
        textureMap.forEach((url) => {
            URL.revokeObjectURL(url)
        })
        textureMap.clear()
    }

    function getFileName(path: string): string {
        // Extract filename from full path (handles both / and \)
        const parts = path.replace(/\\/g, "/").split("/")
        return parts[parts.length - 1]
    }

    async function loadFBXWithTextures(files: FileList) {
        loading = true
        error = ""
        textureCount = 0

        try {
            const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js")
            const THREE = await import("three")

            // Separate FBX and texture files
            let fbxFile: File | null = null
            const textureFiles: File[] = []

            for (const file of files) {
                const name = file.name.toLowerCase()
                if (name.endsWith(".fbx")) {
                    fbxFile = file
                } else if (
                    name.endsWith(".png") ||
                    name.endsWith(".jpg") ||
                    name.endsWith(".jpeg") ||
                    name.endsWith(".tga") ||
                    name.endsWith(".bmp")
                ) {
                    textureFiles.push(file)
                }
            }

            if (!fbxFile) {
                throw new Error("No FBX file found in selection")
            }

            modelName = fbxFile.name

            // Cleanup previous textures
            cleanupTextureMap()

            // Create texture URL map with multiple key variations
            for (const texFile of textureFiles) {
                const url = URL.createObjectURL(texFile)
                const fileName = texFile.name
                const fileNameLower = fileName.toLowerCase()

                // Store with multiple variations for matching
                textureMap.set(fileName, url)
                textureMap.set(fileNameLower, url)
            }

            textureCount = textureFiles.length

            // Remove previous model
            if (currentModel) {
                scene.remove(currentModel)
                currentModel.traverse((child: any) => {
                    if (child.geometry) child.geometry.dispose()
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach((m: any) => {
                                if (m.map) m.map.dispose()
                                m.dispose()
                            })
                        } else {
                            if (child.material.map) child.material.map.dispose()
                            child.material.dispose()
                        }
                    }
                })
            }

            // Create LoadingManager to intercept texture loading
            const manager = new THREE.LoadingManager()

            manager.setURLModifier((url: string) => {
                // Extract just the filename from the full path
                const fileName = getFileName(url)
                const fileNameLower = fileName.toLowerCase()

                // Try to find matching texture
                if (textureMap.has(fileName)) {
                    return textureMap.get(fileName)!
                }
                if (textureMap.has(fileNameLower)) {
                    return textureMap.get(fileNameLower)!
                }

                // Try partial matching
                for (const [key, blobUrl] of textureMap) {
                    if (fileNameLower.includes(key.toLowerCase()) || key.toLowerCase().includes(fileNameLower)) {
                        return blobUrl
                    }
                }

                console.warn("Texture not found:", fileName)
                return url
            })

            const loader = new FBXLoader(manager)
            const arrayBuffer = await fbxFile.arrayBuffer()
            const model = loader.parse(arrayBuffer, "")

            // Fix texture settings after loading
            model.traverse((child: any) => {
                if (child.isMesh && child.material) {
                    const materials = Array.isArray(child.material) ? child.material : [child.material]

                    materials.forEach((material: any) => {
                        if (material.map) {
                            material.map.colorSpace = THREE.SRGBColorSpace
                            material.map.needsUpdate = true
                        }
                        material.needsUpdate = true
                    })
                }
            })

            // Auto-scale and center
            const box = new THREE.Box3().setFromObject(model)
            const size = box.getSize(new THREE.Vector3())
            const center = box.getCenter(new THREE.Vector3())

            const maxDim = Math.max(size.x, size.y, size.z)
            const scale = 100 / maxDim
            model.scale.setScalar(scale)

            model.position.sub(center.multiplyScalar(scale))
            model.position.y = 0

            scene.add(model)
            currentModel = model

            // Adjust camera
            camera.position.set(0, 80, 160)
            controls.target.set(0, 40, 0)
            controls.update()

            loaded = true
        } catch (e: any) {
            error = e.message || "Failed to load FBX file"
            console.error("FBX load error:", e)
        } finally {
            loading = false
        }
    }

    function handleFileSelect(e: Event) {
        const target = e.target as HTMLInputElement
        const files = target.files
        if (files && files.length > 0) {
            loadFBXWithTextures(files)
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault()
        const files = e.dataTransfer?.files
        if (files && files.length > 0) {
            loadFBXWithTextures(files)
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault()
    }

    function handleResize() {
        if (!container || !renderer || !camera) return
        const width = container.clientWidth
        const height = 500
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
    }

    onMount(() => {
        initThree()
        window.addEventListener("resize", handleResize)
    })

    onDestroy(() => {
        window.removeEventListener("resize", handleResize)
        cleanupTextureMap()
        if (animationId) {
            cancelAnimationFrame(animationId)
        }
        if (renderer) {
            renderer.dispose()
        }
        if (controls) {
            controls.dispose()
        }
    })
</script>

<h2 class="relative my-6 text-4xl font-black text-textcolor">3D Viewer</h2>

<div class="mb-4 flex gap-2">
    <Button onclick={() => fileInput.click()}>
        {#if loading}
            <div class="loadmove"></div>
        {:else}
            {language.selectFile}
        {/if}
    </Button>
    <input
        bind:this={fileInput}
        type="file"
        accept=".fbx,.png,.jpg,.jpeg,.tga,.bmp"
        multiple
        class="hidden"
        onchange={handleFileSelect}
    />
</div>

{#if modelName}
    <p class="mb-2 text-textcolor2">
        Model: {modelName}
        {#if textureCount > 0}({textureCount} textures){/if}
    </p>
{/if}

{#if error}
    <p class="mb-2 text-red-500">{error}</p>
{/if}

<div
    bind:this={container}
    class="relative w-full overflow-hidden rounded-lg border border-darkborderc"
    style="height: 500px;"
    ondrop={handleDrop}
    ondragover={handleDragOver}
    role="region"
    aria-label="3D viewer"
>
    <canvas bind:this={canvas} class="block h-full w-full" />
    {#if !loaded && !loading}
        <div
            class="pointer-events-none absolute left-0 top-0 flex h-full w-full items-center justify-center text-textcolor2"
        >
            <span>Drag & drop FBX + texture files here</span>
        </div>
    {/if}
</div>

<p class="mt-2 text-sm text-textcolor2">
    Controls: Left click + drag to rotate, scroll to zoom, right click + drag to pan
</p>
<p class="text-sm text-textcolor2">Tip: Select FBX file together with texture images (PNG, JPG, TGA, BMP)</p>
