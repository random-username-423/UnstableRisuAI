import { getBasename } from "./util"
import type { Database } from "../data/storage/types"

/**
 * Retrieves unpargeable resources from the database.
 *
 * @param {Database} db - The database to retrieve unpargeable resources from.
 * @param {'basename'|'pure'} [uptype='basename'] - The type of unpargeable resources to retrieve.
 * @returns {string[]} - An array of unpargeable resources.
 */
export function getUnpargeables(db: Database, uptype: "basename" | "pure" = "basename") {
    const unpargeable = new Set<string>()

    /**
     * Adds a resource to the unpargeable list if it is not already included.
     *
     * @param {string} data - The resource to add.
     */
    function addUnparge(data: string) {
        if (!data) {
            return
        }
        if (data === "") {
            return
        }
        const bn = uptype === "basename" ? getBasename(data) : data
        unpargeable.add(bn)
    }

    addUnparge(db.customBackground)
    addUnparge(db.userIcon)

    for (const cha of db.characters) {
        if (cha.image) {
            addUnparge(cha.image)
        }
        if (cha.emotionImages) {
            for (const em of cha.emotionImages) {
                addUnparge(em[1])
            }
        }
        if (cha.type !== "group") {
            if (cha.additionalAssets) {
                for (const em of cha.additionalAssets) {
                    addUnparge(em[1])
                }
            }
            if (cha.vits) {
                const keys = Object.keys(cha.vits.files)
                for (const key of keys) {
                    const vit = cha.vits.files[key]
                    addUnparge(vit)
                }
            }
            if (cha.ccAssets) {
                for (const asset of cha.ccAssets) {
                    addUnparge(asset.uri)
                }
            }
        }
    }

    if (db.modules) {
        for (const module of db.modules) {
            const assets = module.assets
            if (assets) {
                for (const asset of assets) {
                    addUnparge(asset[1])
                }
            }
        }
    }

    if (db.personas) {
        db.personas.map((v) => {
            addUnparge(v.icon)
        })
    }

    if (db.characterOrder) {
        db.characterOrder.forEach((item) => {
            if (typeof item === "object" && "imgFile" in item) {
                addUnparge(item.imgFile)
            }
        })
    }
    return Array.from(unpargeable)
}

/**
 * Replaces database resources with the provided replacer object.
 *
 * @param {Database} db - The database object containing resources to be replaced.
 * @param {{[key: string]: string}} replacer - An object mapping original resource keys to their replacements.
 * @returns {Database} - The updated database object with replaced resources.
 */
export function replaceDbResources(db: Database, replacer: { [key: string]: string }): Database {
    const unpargeable: string[] = []

    /**
     * Replaces a given data string with its corresponding value from the replacer object.
     *
     * @param {string} data - The data string to be replaced.
     * @returns {string} - The replaced data string or the original data if no replacement is found.
     */
    function replaceData(data: string): string {
        if (!data) {
            return data
        }
        return replacer[data] ?? data
    }

    db.customBackground = replaceData(db.customBackground)
    db.userIcon = replaceData(db.userIcon)

    for (const cha of db.characters) {
        if (cha.image) {
            cha.image = replaceData(cha.image)
        }
        if (cha.emotionImages) {
            for (let i = 0; i < cha.emotionImages.length; i++) {
                cha.emotionImages[i][1] = replaceData(cha.emotionImages[i][1])
            }
        }
        if (cha.type !== "group") {
            if (cha.additionalAssets) {
                for (let i = 0; i < cha.additionalAssets.length; i++) {
                    cha.additionalAssets[i][1] = replaceData(cha.additionalAssets[i][1])
                }
            }
        }
    }
    return db
}
