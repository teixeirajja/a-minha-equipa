import {client,installUi,load,toast} from './listagens-core.js?v=6.14';
import {bind} from './listagens-ui.js?v=6.14';

async function init(){
  try{
    installUi();bind();
    const {data:{session}}=await client.auth.getSession();
    if(session)await load();
    client.auth.onAuthStateChange((_e,s)=>{if(s)load().catch(e=>toast(e.message))});
  }catch(e){console.error('QGApp Listagens:',e)}
}
init();
