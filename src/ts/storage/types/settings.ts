export interface OobaSettings {
    max_new_tokens: number;
    do_sample: boolean;
    temperature: number;
    top_p: number;
    typical_p: number;
    repetition_penalty: number;
    encoder_repetition_penalty: number;
    top_k: number;
    min_length: number;
    no_repeat_ngram_size: number;
    num_beams: number;
    penalty_alpha: number;
    length_penalty: number;
    early_stopping: boolean;
    seed: number;
    add_bos_token: boolean;
    truncation_length: number;
    ban_eos_token: boolean;
    skip_special_tokens: boolean;
    top_a: number;
    tfs: number;
    epsilon_cutoff: number;
    eta_cutoff: number;
    formating: {
        header: string;
        systemPrefix: string;
        userPrefix: string;
        assistantPrefix: string;
        seperator: string;
        useName: boolean;
    };
}

export interface AINsettings {
    top_p: number;
    rep_pen: number;
    top_a: number;
    rep_pen_slope: number;
    rep_pen_range: number;
    typical_p: number;
    badwords: string;
    stoptokens: string;
    top_k: number;
}

export interface NAIImgConfig {
    width: number;
    height: number;
    sampler: string;
    noise_schedule: string;
    steps: number;
    scale: number;
    cfg_rescale: number;
    sm: boolean;
    sm_dyn: boolean;
    noise: number;
    strength: number;
    image: string;
    base64image: string;
    InfoExtracted: number;
    //add 4
    autoSmea: boolean;
    use_coords: boolean;
    legacy_uc: boolean;
    v4_prompt: NAIImgConfigV4Prompt;
    v4_negative_prompt: NAIImgConfigV4NegativePrompt;
    //add vibe
    reference_image_multiple?: string[];
    reference_strength_multiple?: number[];
    vibe_data?: NAIVibeData;
    vibe_model_selection?: string;
    //add variety+ and decrisp options
    variety_plus: boolean;
    decrisp: boolean;
    //add character reference
    reference_mode: string;
    character_image: string;
    character_base64image: string;
    style_aware: boolean;
}

//add 4
export interface NAIImgConfigV4Prompt {
    caption: NAIImgConfigV4Caption;
    use_coords: boolean;
    use_order: boolean;
}

//add 4
export interface NAIImgConfigV4NegativePrompt {
    caption: NAIImgConfigV4Caption;
    legacy_uc: boolean;
}

//add 4
export interface NAIImgConfigV4Caption {
    base_caption: string;
    char_captions: NAIImgConfigV4CharCaption[];
}

export interface NAIImgConfigV4CharCaption {
    char_caption: string;
    centers: {
        x: number;
        y: number;
    }[];
}

// NAI Vibe Data interfaces
export interface NAIVibeData {
    identifier: string;
    version: number;
    type: string;
    image: string;
    id: string;
    encodings: {
        [key: string]: {
            [key: string]: NAIVibeEncoding;
        };
    };
    name: string;
    thumbnail: string;
    createdAt: number;
    importInfo: {
        model: string;
        information_extracted: number;
        strength: number;
    };
}

export interface NAIVibeEncoding {
    encoding: string;
    params: {
        information_extracted: number;
    };
}
export interface sdConfig {
    width: number;
    height: number;
    sampler_name: string;
    script_name: string;
    denoising_strength: number;
    enable_hr: boolean;
    hr_scale: number;
    hr_upscaler: string;
}
export interface ComfyConfig {
    workflow: string;
    posNodeID: string;
    posInputName: string;
    negNodeID: string;
    negInputName: string;
    timeout: number;
}

