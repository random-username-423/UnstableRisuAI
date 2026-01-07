import { getCurrentCharacter } from 'src/ts/storage/database.svelte'
import { type groupChat } from 'src/ts/storage/types/character'
import { type character } from 'src/ts/storage/types/character'
import { DBState } from 'src/ts/stores.svelte'

export function getCharacter(id: string): character | groupChat {
  return id ? DBState.db.characters.find((c) => c.chaId === id || c.name === id) : getCurrentCharacter()
}
