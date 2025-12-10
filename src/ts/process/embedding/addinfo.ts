import { getDatabase } from "src/ts/data/storage/database.svelte";
import type { Chat, character } from "src/ts/data/storage/types";
import { HypaProcesser } from 'src/ts/process/memory/hypamemory'
import { getUserName } from "src/ts/utils/util";

export async function additionalInformations(char: character,chats:Chat,){
    const processer = new HypaProcesser()
    const db = getDatabase()

    const info = char.additionalText
    if(info){
        const infos = info.split('\n\n')

        await processer.addText(infos)
        const filteredChat = chats.message.slice(0, 4).map((chat) => {
            let name = chat.saying ?? ''

            if(!name){
                if(chat.role === 'user'){
                    name = getUserName()
                }
                else{
                    name = char.name
                }
            }

            return `${name}: ${chat.data}`
        }).join("\n\n")
        const searched = await processer.similaritySearch(filteredChat)
        const result = searched.slice(0,3).join("\n\n")
        return result
    }

    return ''

}