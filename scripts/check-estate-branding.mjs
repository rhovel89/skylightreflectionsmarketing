import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const roots=['app','components','lib']
const extensions=new Set(['.ts','.tsx','.js','.jsx','.json','.md'])
const forbidden=[
  /Estate\s*Legacy\s*Pro/i,
  /EstateLegacyPro/i,
  /estate[-_]legacy[-_]pro/i,
  /estatelegacypro\.com/i,
  /Legacy\s+Pro/i,
]
const hits=[]

function walk(dir){
  for(const entry of readdirSync(dir)){
    const full=join(dir,entry)
    const stat=statSync(full)
    if(stat.isDirectory()){walk(full);continue}
    if(!extensions.has(extname(full)))continue
    const text=readFileSync(full,'utf8')
    for(const rule of forbidden){
      if(rule.test(text)){hits.push(relative(process.cwd(),full));break}
    }
  }
}

for(const root of roots)walk(root)
if(hits.length){
  console.error('Forbidden estate-planning partner branding found in application source:')
  for(const file of hits)console.error(` - ${file}`)
  process.exit(1)
}
console.log('Estate-planning public/application branding guard passed.')
