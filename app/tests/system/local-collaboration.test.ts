import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emptyWork} from '../../upstream/lib/work-contract.ts';
import {buildCollaborationBrief as buildWebsiteBrief} from '../../upstream/lib/collaboration-model.ts';
import {buildCollaborationBrief, collaborationMarkdown, parseLowReport, reportMatchesBrief} from '../../src/local-collaboration.ts';

const work=emptyWork();work.updatedAt='2026-09-30T12:00:00.000Z';
function reportFor(brief:ReturnType<typeof buildCollaborationBrief>){return parseLowReport(JSON.stringify({schemaVersion:1,revision:brief.revision,missionId:brief.missionId,briefHash:brief.briefHash,from:'low',acknowledged:true,referenceCommit:brief.referenceCommit,baseCommit:brief.referenceCommit,status:'partial',summary:'Lokaler Prüfbericht als ungeprüfter Testfall.',changedFiles:['docs/low/local.md'],tests:[],blockers:[]}))}
test('local cooperation artifact binds provenance and manual transport into its deterministic digest',()=>{
 const before=JSON.stringify(work),brief=buildCollaborationBrief(work,'2026-01-01T00:00:00Z');
 assert.equal(brief.context.kind,'device-local');assert.equal(brief.context.provenance.personalCloudImport,'not-verified');assert.equal(brief.context.provenance.personalWebsiteAssignment,'not-established');
 assert.equal(brief.transport.kind,'manual-local-export');assert.equal(brief.transport.cloudSynchronization,false);assert.equal(brief.transport.automaticDelivery,false);assert.equal(brief.transport.separateWebsiteReadPath.bindsThisLocalBrief,false);
 const {generatedAt:_time,briefHash,...content}=brief;
 assert.equal(createHash('sha256').update(JSON.stringify(content)).digest('hex'),briefHash);
 assert.equal(briefHash,buildCollaborationBrief(work,'2026-02-01T00:00:00Z').briefHash);
 assert.notEqual(briefHash,buildWebsiteBrief(work).briefHash);
 const forged=structuredClone(content);forged.context.provenance.origin='different-device' as any;
 assert.notEqual(createHash('sha256').update(JSON.stringify(forged)).digest('hex'),briefHash);
 assert.equal(JSON.stringify(work),before);
});
test('clipboard Markdown contains exactly the same semantic brief and binding as JSON',()=>{
 const text=collaborationMarkdown(work),json=JSON.parse(text.slice(text.indexOf('{'),text.lastIndexOf('}')+1));
 const {generatedAt:_a,...markdown}=json,{generatedAt:_b,...brief}=buildCollaborationBrief(work);
 assert.deepEqual(markdown,brief);assert.match(text,/Kein verifizierter persönlicher Cloudimport/);
});
test('local report binding rejects the website brief even with otherwise identical state',()=>{
 const brief=buildCollaborationBrief(work),report=reportFor(brief);
 assert.equal(reportMatchesBrief(report,work),true);
 assert.equal(reportMatchesBrief({...report,briefHash:buildWebsiteBrief(work).briefHash},work),false);
 assert.equal(reportMatchesBrief(report,{...work,updatedAt:'2026-09-30T12:00:00.001Z'}),false);
 assert.equal(reportMatchesBrief(report,undefined),false);
 for(const key of ['missionId','revision','referenceCommit'] as const)assert.equal(reportMatchesBrief({...report,[key]:'different'},work),false);
 assert.throws(()=>parseLowReport(JSON.stringify({...report,changedFiles:['lib/work-contract.ts']})));
 assert.throws(()=>parseLowReport(JSON.stringify({...report,authority:'granted'})));
});
