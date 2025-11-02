const API_BASE = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent';

// UI elements
const chatBox = document.getElementById('chatBox');
const inputField = document.getElementById('inputField');
const btnSend = document.getElementById('btnSend');
const btnMic = document.getElementById('btnMic');
const btnSpeak = document.getElementById('btnSpeak');
const btnKey = document.getElementById('btnKey');
const modal = document.getElementById('modal');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKey');
const cancelKeyBtn = document.getElementById('cancelKey');
const historyList = document.getElementById('historyList');
const btnExportJSON = document.getElementById('btnExportJSON');
const btnClearHistory = document.getElementById('btnClearHistory');
const templatesPanel = document.getElementById('templatesPanel');
const btnTemplates = document.getElementById('btnTemplates');
const btnExport = document.getElementById('btnExport');
const btnTemplatesToggle = document.getElementById('btnTemplates');

let API_KEY = localStorage.getItem('GEMINI_API_KEY') || '';
let historyArr = JSON.parse(localStorage.getItem('CHAT_HISTORY') || '[]');

// helpers
function timeNow() { return new Date().toLocaleString(); }
function renderHistory() {
  historyList.innerHTML = '';
  historyArr.forEach((h, idx)=>{
    const el = document.createElement('div');
    el.className = 'history-item';
    el.innerHTML = '<div style="flex:1"><strong>' + (h.role==='user'?'Bạn':'AI') + '</strong>: ' + (h.prompt||h.text).slice(0,80) + '</div>' +
                   '<div><button data-idx="'+idx+'" class="loadBtn">Open</button></div>';
    historyList.appendChild(el);
  });
}

function appendMessage(role, text){
  const div = document.createElement('div');
  div.className = 'msg ' + (role==='user'?'user':'bot');
  div.innerHTML = (role==='user'? '👩‍🏫 ':'🤖 ') + text + '<span class="time">' + timeNow() + '</span>';
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function saveHistory(item){
  historyArr.unshift(item);
  if (historyArr.length>300) historyArr.pop();
  localStorage.setItem('CHAT_HISTORY', JSON.stringify(historyArr));
  renderHistory();
}

btnKey.addEventListener('click', ()=> {
  apiKeyInput.value = API_KEY;
  modal.setAttribute('aria-hidden','false');
});
saveKeyBtn.addEventListener('click', ()=> {
  API_KEY = apiKeyInput.value.trim();
  if (!API_KEY) return alert('Vui lòng nhập API Key!');
  localStorage.setItem('GEMINI_API_KEY', API_KEY);
  modal.setAttribute('aria-hidden','true');
  alert('✅ API Key đã lưu');
});
cancelKeyBtn.addEventListener('click', ()=> modal.setAttribute('aria-hidden','true'));

btnTemplates.addEventListener('click', ()=> templatesPanel.hidden = !templatesPanel.hidden);
document.querySelectorAll('.tpl').forEach(b=> b.addEventListener('click', ()=> inputField.value = b.textContent));
document.querySelectorAll('.quickBtn').forEach(b=> b.addEventListener('click', ()=> inputField.value = b.textContent));

// TTS
function speak(text, lang='vi-VN'){ try{ const u = new SpeechSynthesisUtterance(text); u.lang = lang; speechSynthesis.cancel(); speechSynthesis.speak(u); }catch(e){console.warn(e);} }
btnSpeak.addEventListener('click', ()=> { const bots = chatBox.querySelectorAll('.msg.bot'); if(!bots.length) return; const txt = bots[bots.length-1].textContent.replace('🤖 ',''); speak(txt, 'vi-VN'); });

// STT
let recognition;
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SR();
  recognition.lang = 'vi-VN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = e => { inputField.value = e.results[0][0].transcript; };
  recognition.onerror = e => console.warn('STT error', e);
}
btnMic.addEventListener('click', ()=> { if(!recognition) return alert('STT không hỗ trợ trên môi trường này'); recognition.start(); });

// Export functions (PDF/Word)
async function exportPDF(){
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([612, 792]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  let y = 750;
  for (let m of historyArr.slice().reverse()){
    const lines = m.text.match(/.{1,80}/g) || [m.text];
    for (let line of lines){
      page.drawText((m.role==='user'?'Bạn: ':'AI: ')+line, { x: 40, y, size: 11, font, color: rgb(0.9,0.9,0.9) });
      y -= 14;
      if (y < 60){ page = pdfDoc.addPage([612,792]); y = 750; }
    }
  }
  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], {type:'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'Chatbot_GiaoVien_'+new Date().toISOString().slice(0,10)+'.pdf'; a.click();
}

async function exportDOCX(){
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const doc = new Document({ sections: [{ children: historyArr.map(m => new Paragraph({ children: [ new TextRun({ text: (m.role==='user'?'Bạn: ':'AI: ')+m.text, color: m.role==='user'?'00BFFF':'90EE90' }) ] }) ) }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'Chatbot_GiaoVien_'+new Date().toISOString().slice(0,10)+'.docx'; a.click();
}

btnExport.addEventListener('click', ()=> {
  const choice = confirm('OK = Xuất PDF (toàn bộ). Cancel = Xuất Word (phản hồi gần nhất).');
  if (choice) exportPDF(); else exportDOCX();
});

btnExportJSON.addEventListener('click', ()=> {
  const blob = new Blob([JSON.stringify(historyArr, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'chat_history.json'; a.click();
});
btnClearHistory.addEventListener('click', ()=> { if(confirm('Xóa lịch sử?')){ historyArr=[]; localStorage.removeItem('CHAT_HISTORY'); renderHistory(); chatBox.innerHTML=''; } });

// send
async function sendToGemini(prompt){
  try{
    const res = await fetch(API_BASE + '?key=' + API_KEY, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], temperature: 0.2, maxOutputTokens: 800 })
    });
    return await res.json();
  }catch(e){ return { error: e.toString() }; }
}

function buildPrompt(text){
  const mode = 'full';
  const lang = 'both';
  let system = 'You are an AI teaching assistant. Provide bilingual Vietnamese and English replies.';
  let instr = 'Create lesson plans, questions, teaching suggestions, and assessments.';
  return system + '\n' + instr + '\nTeacher asks: ' + text;
}

btnSend.addEventListener('click', async ()=> {
  const text = inputField.value.trim();
  if (!text) return;
  if (!API_KEY) return alert('Vui lòng nhập API Key (🔑) trước.');
  appendMessage('user', text);
  saveHistory({ role:'user', prompt:text, text });
  inputField.value='';
  appendMessage('bot', '⏳ Đang xử lý...');
  const prompt = buildPrompt(text);
  const res = await sendToGemini(prompt);
  // remove spinner
  const bots = chatBox.querySelectorAll('.msg.bot'); if (bots.length) bots[bots.length-1].remove();
  if (res.error) { appendMessage('bot', '⚠️ Lỗi: ' + (res.error.message || res.error)); console.error(res); return; }
  const reply = res?.candidates?.[0]?.content?.parts?.[0]?.text || '❌ Không nhận được phản hồi.';
  appendMessage('bot', reply);
  saveHistory({ role:'bot', prompt:reply, text: reply });
});

// history click open
historyList.addEventListener('click', e=> {
  if (e.target.classList.contains('loadBtn')){
    const idx = parseInt(e.target.dataset.idx); const item = historyArr[idx]; if (item) inputField.value = item.prompt;
  }
});

// init
renderHistory();
if (!API_KEY) setTimeout(()=>{ if(confirm('Bạn chưa nhập API Key. Muốn nhập bây giờ?')) btnKey.click(); }, 600);
