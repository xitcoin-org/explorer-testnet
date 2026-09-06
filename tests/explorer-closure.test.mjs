import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { prevoteParticipation, consensusStep } from '../src/libs/consensus.ts';
import { walletPublicName, externalPrice, walletImageFallback } from '../src/libs/explorerPresentation.ts';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { createSSRApp } from 'vue';
import { renderToString } from '@vue/server-renderer';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';

test('consensus uses exact voting power, current snapshot zeros and invalid data', () => {
  assert.equal(prevoteParticipation('BA{4:____} 0/20000000 = 0.00'), '0 %');
  assert.equal(prevoteParticipation('BA{4:xxx_} 15000000/20000000 = 0.75'), '75 %');
  assert.equal(prevoteParticipation('BA{3:xx_} 2/3 = 0.67'), '66.67 %');
  assert.equal(prevoteParticipation('BA{2:x_} 1/20000000 = 0.00'), '< 0.01 %');
  for (const v of [null, '', 'BA{1:_} 0/0 = 0.00', 'BA{1:x} 2/1 = 2.00']) assert.equal(prevoteParticipation(v), 'Non disponible');
  assert.match(consensusStep('1'), /NewHeight/);assert.equal(consensusStep('99'), 'Non disponible');
});
test('wallet public name differs from route; unquoted testnet price is unavailable', () => {
  assert.equal(walletPublicName({chainName:'xitcoin-testnet',prettyName:'Xitcoin Public Testnet'}),'Xitcoin Public Testnet');
  const c=JSON.parse(fs.readFileSync(new URL('../chains/testnet/xitcoin-testnet.json',import.meta.url)));
  assert.equal(c.assets[0].base,'axtc');assert.equal(c.assets[0].symbol,'XTC');assert.equal(c.assets[0].exponent,'18');
  assert.equal(c.coingecko,'');assert.equal(c.assets[0].coingecko_id,'');
  for(const x of [undefined,null,NaN,Infinity,-1,'0']) assert.equal(externalPrice(x),undefined);
  assert.equal(externalPrice(0),0);assert.equal(externalPrice(1.23),1.23);
});
test('wallet artwork fallback replaces a failed optional URL once',()=>{
  const img={src:'https://assets.leapwallet.io/fail.svg',alt:'',closest:s=>s==='ping-connect-wallet'};
  walletImageFallback(img);assert.equal(img.src,'/assets/wallets/fallback.svg');
  walletImageFallback(img);assert.equal(img.src,'/assets/wallets/fallback.svg');
  const other={src:'https://example.org/image.png',closest:()=>null};walletImageFallback(other);assert.equal(other.src,'https://example.org/image.png');
});
test('empty table rows render explicit states with the correct column span',async()=>{
  for(const file of ['src/modules/[chain]/tx/index.vue','src/modules/[chain]/staking/[validator].vue']){
    const source=fs.readFileSync(file,'utf8');const rows=[...source.matchAll(/<tr v-if="!([^\"]+)\?\.length"><td colspan="(\d+)" class="p-4">(.*?)<\/td><\/tr>/gs)];assert.ok(rows.length);
    for(const row of rows){const key=row[1];const parts=key.split('.');for(const value of [[],undefined]){
      const state={[parts[0]]:{[parts[1]]:value}};
      const {code}=compile(`<table><tbody>${row[0]}</tbody></table>`,{mode:'function'});
      const html=await renderToString(createSSRApp({data:()=>state,render:new Function('Vue',code)(Vue)}));
      assert.match(html,new RegExp(`colspan="${row[2]}"`));assert.match(html,value?/Aucun/:/Non disponible/);
    }}
  }
});
test('changed Vue templates compile and validator table headings remain separate cells',()=>{
  for(const file of ['src/modules/[chain]/consensus/index.vue','src/modules/[chain]/staking/[validator].vue','src/modules/[chain]/staking/index.vue','src/modules/wallet/suggest.vue','src/components/ProposalListItem.vue']){
    const source=fs.readFileSync(file,'utf8');const {descriptor}=parse(source);const result=compileTemplate({source:descriptor.template.content,filename:file,id:file});assert.deepEqual(result.errors,[]);
    if(file.includes('[validator]')){assert.equal((source.match(/<thead><tr>/g)||[]).length,3);assert.match(source,/aucun rendement garanti/);assert.match(source,/API de cette chaîne ne fournit pas/);}
  }
  const index=fs.readFileSync('index.html','utf8');assert.ok(!index.includes('gtag('));
  assert.ok(!index.match(/script-src[^\"]*cloudflareinsights/));
});

test('economic parameters preserve units and exact atomic conversion, including real zeros', async()=>{
  const {parameterValue}=await import('../src/libs/validatorProfile.ts');
  const assets=[{base:'axtc',symbol:'XTC',exponent:18}];
  assert.equal(parameterValue([{amount:'10000000',denom:'axtc'}],'min_deposit',assets),'0.00000000001 XTC');
  assert.equal(parameterValue('0.000000000000000000','inflation'),'0 %');
  assert.equal(parameterValue(undefined,'inflation'),'Non disponible');
  assert.equal(parameterValue('bad','inflation'),'Non disponible');
  assert.equal(parameterValue('0.02','community_tax'),'2 %');
  assert.equal(parameterValue('5250000000000000000000000000','max_supply',assets),'5250000000 XTC');
  assert.equal(parameterValue('0.25','arbitrary'),'0.25');
});

test('accessible controls keep explicit names and table scroll regions are focusable',()=>{
  for (const [path,text] of [
    ['src/layouts/components/NavbarSearch.vue','aria-label="Search explorer"'],
    ['src/layouts/components/NavbarThemeSwitcher.vue','aria-label="Change color theme"'],
    ['src/layouts/components/DefaultLayout.vue','aria-label="Open navigation"'],
    ['src/modules/[chain]/supply/index.vue','tabindex="0" role="region"'],
    ['src/modules/[chain]/staking/[validator].vue','tabindex="0" role="region"'],
    ['src/modules/[chain]/faucet/XitcoinFaucet.vue',':disabled="!canClaim"'],
  ]) {
    const source=fs.readFileSync(path,'utf8');assert.ok(source.includes(text),path);
    const {descriptor}=parse(source);assert.deepEqual(compileTemplate({source:descriptor.template.content,filename:path,id:path}).errors,[]);
  }
});
