export const PAGE_SIZE=20

/** Rangos inclusivos requeridos por la API de PostgREST. */
export function pageRange(page:number,size=PAGE_SIZE){
  const current=Math.max(0,Math.floor(page))
  const safeSize=Math.max(1,Math.floor(size))
  const from=current*safeSize
  return {from,to:from+safeSize-1}
}
export function pageCount(total:number,size=PAGE_SIZE){
  return Math.max(1,Math.ceil(Math.max(0,total)/Math.max(1,size)))
}
export function pageLabel(page:number,total:number,size=PAGE_SIZE){
  if(total===0)return '0 resultados'
  const {from,to}=pageRange(page,size)
  return `${Math.min(from+1,total)}–${Math.min(to+1,total)} de ${total}`
}
