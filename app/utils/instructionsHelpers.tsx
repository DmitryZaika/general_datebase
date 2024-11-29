export interface InstructionsBasic {
     title: string; id: number; parent_id:number 
    }

export interface InstructionsReturn 
    { key: number; value: string }


export function parentOptions (instructions: InstructionsBasic[]) : InstructionsReturn[] {
   let values  = instructions.map(
        (instruction) => ({
          key: instruction.id,
          value: instruction.title,}))
          values.push({ key: 0, value: "Main" })
         return values 

} 






export function afterOptions(parent_id : string | undefined,  instructions: InstructionsBasic[]) : InstructionsReturn[]  {
  return   parent_id ? instructions.filter(item => item.parent_id=== parseInt(parent_id) ).map(
        (instruction) => ({
          key: instruction.id,
          value: instruction.title,
        })): []
    }

