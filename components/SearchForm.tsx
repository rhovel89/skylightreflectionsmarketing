'use client'
import{useMemo,useState}from'react';import{LAUNCH_CITIES}from'@/lib/constants';import type{Category,Location}from'@/lib/types'
type SearchDefaults={category?:string;city?:string;q?:string}
type SearchAvailability=Record<string,Record<string,number>>
export function SearchForm({categories=[],locations=[],defaults={},availability={}}:{categories?:Category[];locations?:Location[];defaults?:SearchDefaults;availability?:SearchAvailability}){
 const cityOptions=locations.length?locations.map(l=>({key:l.id,value:l.slug,label:l.name})):LAUNCH_CITIES.map(c=>({key:c,value:c.toLowerCase(),label:c}));
 const[city,setCity]=useState(defaults.city??'');const[category,setCategory]=useState(defaults.category??'');const counts=city?(availability[city]??{}):null;
 const categoryOptions=useMemo(()=>!city?categories:categories.filter(c=>Number(counts?.[c.slug]??0)>0||c.slug===category),[categories,city,counts,category]);
 const availableCount=city?Object.values(counts??{}).filter(v=>Number(v)>0).length:0;
 function changeCity(next:string){setCity(next);if(category&&next&&Number(availability[next]?.[category]??0)<1)setCategory('')}
 return <form className="searchbox" action="/search" method="get"><select name="category" value={category} onChange={e=>setCategory(e.target.value)} aria-label="Business category"><option value="">{city?`What do you need? · ${availableCount} categor${availableCount===1?'y':'ies'} available`:'What do you need?'}</option>{categoryOptions.map(c=>{const n=city?Number(counts?.[c.slug]??0):0;return <option key={c.id} value={c.slug} disabled={Boolean(city&&n<1)}>{c.name}{city?` (${n})`:''}</option>})}</select><select name="city" value={city} onChange={e=>changeCity(e.target.value)} aria-label="City"><option value="">Choose a city</option>{cityOptions.map(c=><option key={c.key} value={c.value}>{c.label}</option>)}</select><input name="q" defaultValue={defaults.q??''} placeholder="Business name or keyword" aria-label="Business name or keyword"/><button className="btn btn-primary" type="submit">Search Local Pros</button></form>}
