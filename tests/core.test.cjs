const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../dist/index.html'),'utf8');
const script=[...html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g)].at(-1)[1];
new vm.Script(script); // Parse the entire application, including UI handlers.
const context=vm.createContext({structuredClone,Date,Set,Error});
vm.runInContext(script.split('const embedded=')[0]+'\nglobalThis.core={initialState,validateState,validatePublication,publishNode,publicState,stats,escapeHtml};',context);
const c=context.core;
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('81 participants; historical route does not predetermine groups',()=>{const s=c.initialState();assert.equal(s.settings.participants,81);assert.equal(s.nodes.length,13);assert.equal(s.nodes[0].name,'何家冲');assert.equal(s.nodes.at(-1).name,'永坪');assert.equal(c.stats(s).groups,0);assert.equal(c.stats(s).teaching,0);assert(c.validateState(s));});
test('publishing neutral text needs no solution/test/revision fields',()=>{const s=c.initialState(),n=s.nodes[0];n.teaching=true;n.group='第1组';n.draft.title='我们的节点故事';n.draft.text='我们共同讲述了这个节点。';c.publishNode(n);assert.equal(n.published.text,n.draft.text);assert(c.validateState(s));assert.equal(c.stats(s).published,1);});
test('unassigned nodes cannot publish',()=>{const n=c.initialState().nodes[0];n.draft.title='作品';n.draft.text='内容';assert.throws(()=>c.publishNode(n),/小组/);});
test('one group cannot belong to two nodes; normalization applies',()=>{const s=c.initialState();s.nodes[0].teaching=s.nodes[1].teaching=true;s.nodes[0].group='Group １';s.nodes[1].group=' group 1 ';assert.throws(()=>c.validateState(s),/只能对应一个节点/);});
test('draft edits keep previous published snapshot intact',()=>{const n=c.initialState().nodes[0];n.teaching=true;n.group='一组';n.draft.title='标题';n.draft.text='第一版';n.draft.images=[{name:'image.png',data:'data:image/png;base64,AA'}];c.publishNode(n);n.draft.text='未发布的文字';n.draft.images[0].data='private';assert.equal(n.published.text,'第一版');assert.equal(n.published.images[0].data,'data:image/png;base64,AA');});
test('viewer export strips all private draft text and media',()=>{const s=c.initialState(),n=s.nodes[0];n.draft.title='private-secret';n.draft.images=[{name:'private',data:'private-base64'}];n.updatedAt='private-time';const p=c.publicState(s),json=JSON.stringify(p);assert(!json.includes('private-secret'));assert(!json.includes('private-base64'));assert(!json.includes('private-time'));assert.equal(p.nodes.length,13);});
test('photo-only or video-only records can be published',()=>{for(const kind of ['images','videos']){const n=c.initialState().nodes[0];n.teaching=true;n.group='一组';n.draft.title='节点记录';n.draft[kind]=[{name:'record',data:'data:video/mp4;base64,AA'}];c.publishNode(n);assert(n.published);}});
test('publishing empty content is rejected',()=>{const n=c.initialState().nodes[0];n.teaching=true;n.group='一组';n.draft.title='标题';assert.throws(()=>c.publishNode(n),/至少/);});
test('changing published group without republishing is rejected',()=>{const s=c.initialState(),n=s.nodes[0];n.teaching=true;n.group='一组';n.draft.title='标题';n.draft.text='内容';c.publishNode(n);n.group='二组';assert.throws(()=>c.validateState(s),/更新发布/);c.publishNode(n);assert(c.validateState(s));});
test('history nodes remain when unpublished; withdrawn data stays private',()=>{const s=c.initialState(),n=s.nodes[0];n.teaching=true;n.group='一组';n.draft.title='secret-title';n.draft.text='secret-content';c.publishNode(n);n.published=null;assert.equal(c.stats(s).published,0);assert.equal(c.publicState(s).nodes.length,13);assert(!JSON.stringify(c.publicState(s)).includes('secret-content'));});
test('user-provided strings are escaped for HTML',()=>{assert.equal(c.escapeHtml('<img onerror="x">&'), '&lt;img onerror=&quot;x&quot;&gt;&amp;');});
console.log(`${count} checks passed.`);
