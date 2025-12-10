import localforage from "localforage"
import { replaceDbResources } from "../../utils/dbUtils"
import { isNodeServer } from "src/ts/utils/env";
import { NodeStorage } from "./nodeStorage"
import { alertInput, alertSelect, alertStore } from "../../utils/alert"
import { getDatabase } from "./database.svelte"
import type { Database } from "./types"
import { AccountStorage } from "./accountStorage"
import { decodeRisuSave, encodeRisuSaveLegacy } from "./risuSave";
import { language } from "src/lang"

export class AutoStorage{
    isAccount:boolean = false

    realStorage:LocalForage|NodeStorage|AccountStorage

    async setItem(key:string, value:Uint8Array<ArrayBuffer>):Promise<string|null> {
        await this.Init()
        if(this.isAccount){
            return await (this.realStorage as AccountStorage).setItem(key, value)
        }
        await this.realStorage.setItem(key, value)
        return null
    }
    async getItem(key:string):Promise<Buffer> {
        await this.Init()
        return await this.realStorage.getItem(key)

    }
    async keys():Promise<string[]>{
        await this.Init()
        return await this.realStorage.keys()

    }
    async removeItem(key:string){
        await this.Init()
        return await this.realStorage.removeItem(key)
    }

    async checkAccountSync(){
        await this.Init()
        let db = getDatabase()
        if(this.isAccount){
            return true
        }
        if(localStorage.getItem('dosync') === 'avoid'){
            return false
        }
        if((localStorage.getItem('dosync') === 'sync' || db?.account?.useSync) && (localStorage.getItem('accountst') !== 'able')){
            const keys = await this.realStorage.keys()
            let i = 0;
            const accountStorage = new AccountStorage()

            const a = accountStorage.getItem('database/database.bin')
            if(a){
                const sel = await alertSelect([language.loadDataFromAccount, language.saveCurrentDataToAccount])
                if(sel === "0"){
                    this.realStorage = accountStorage
                    alertStore.set({
                        type: "none",
                        msg: ""
                    })
                    localStorage.setItem('accountst', 'able')
                    localStorage.setItem('fallbackRisuToken',JSON.stringify(db.account))
                    this.isAccount = true
                    return true
                }
            }

            const confirm = await alertInput(`to overwrite your data, type "RISUAI"`)
            if(confirm !== "RISUAI"){
                localStorage.setItem('dosync', 'avoid')
                return false
            }

            let replaced:{[key:string]:string} = {}
            
            for(const key of keys){
                alertStore.set({
                    type: "wait",
                    msg: `Migrating your data...(${i}/${keys.length})`
                })
                const rkey = await accountStorage.setItem(key,await this.realStorage.getItem(key) as Uint8Array<ArrayBuffer>)
                if(rkey !== key){
                    replaced[key] = rkey
                }
                i += 1
            }

            const dba = replaceDbResources(db, replaced)
            const comp = encodeRisuSaveLegacy(dba, 'compression')
            //try decoding
            try {
                const z:Database = await decodeRisuSave(comp)
                if(z.formatversion){
                    await accountStorage.setItem('database/database.bin', comp)
                }
                
            } catch (error) {}
            this.realStorage = accountStorage
            alertStore.set({
                type: "none",
                msg: ""
            })

            localStorage.setItem('accountst', 'able')
            localStorage.setItem('fallbackRisuToken',JSON.stringify(db.account))
            this.isAccount = true
            await localforage.clear()
            return true
        }
        else if(localStorage.getItem('accountst') === 'able'){
            localStorage.setItem('accountst', 'able')
            this.realStorage = new AccountStorage()
            this.isAccount = true
        }
        return false
    }

    async Init(){
        if(!this.realStorage){
            if(localStorage.getItem('accountst') === 'able'){
                this.realStorage = new AccountStorage()
                this.isAccount = true
                return
            }
            if(isNodeServer){
                console.log("using node storage")
                this.realStorage = new NodeStorage()
                return
            }
            console.log("using forage storage")
            this.realStorage = localforage.createInstance({
                name: "risuai"
            })
        }
    }

    listItem = this.keys
}

/**
 * Singleton instance of AutoStorage.
 * Automatically selects the appropriate storage backend based on the environment.
 */
export const forageStorage = new AutoStorage()