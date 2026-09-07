import { deflateSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
const size = 256
const stars = [ [[.43,.18],[.49,.40],[.70,.46],[.49,.52],[.43,.74],[.37,.52],[.15,.46],[.37,.40]], [[.77,.16],[.79,.24],[.87,.26],[.79,.28],[.77,.36],[.75,.28],[.67,.26],[.75,.24]] ]
const inside = (x: number, y: number, polygon: number[][]) => { let yes = false; for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) { const [a,b]=polygon[i], [c,d]=polygon[j]; if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes } return yes }
const pixels = Buffer.alloc((size * 4 + 1) * size)
for(let y=0;y<size;y++) for(let x=0;x<size;x++) {
  const at = y*(size*4+1)+1+x*4; let r=0,g=0,b=0,alpha=0
  for(let sy=0;sy<4;sy++)for(let sx=0;sx<4;sx++) {
    const u=(x+(sx+.5)/4)/size,v=(y+(sy+.5)/4)/size
    const dx=Math.max(.20-u,0,u-.80),dy=Math.max(.20-v,0,v-.80)
    if(dx*dx+dy*dy>.20*.20)continue
    const white=stars.some(p=>inside(u,v,p)); r+=white?255:53;g+=white?255:104;b+=white?255:232;alpha++
  }
  if(alpha){pixels[at]=r/alpha;pixels[at+1]=g/alpha;pixels[at+2]=b/alpha;pixels[at+3]=255*alpha/16}
}
const crc=(buffer:Buffer)=>{let c=0xffffffff;for(const b of buffer){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
const chunk=(name:string,data:Buffer)=>{const type=Buffer.from(name);const head=Buffer.alloc(4);head.writeUInt32BE(data.length);const tail=Buffer.alloc(4);tail.writeUInt32BE(crc(Buffer.concat([type,data])));return Buffer.concat([head,type,data,tail])}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))])
const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18)
await mkdir('build',{recursive:true});await writeFile('build/icon.ico',Buffer.concat([header,png]));await writeFile('build/icon.png',png)
await writeFile('build/icon.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" rx="51" fill="#3568e8"/>${stars.map(p=>`<polygon points="${p.map(([x,y])=>`${x*256},${y*256}`).join(' ')}" fill="white"/>`).join('')}</svg>\n`)
