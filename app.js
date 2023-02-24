const func = async () => {
}
  
window.webView
      .changeUrl('https://www.electronjs.org/docs/latest/tutorial/ipc');

const inputBar = document.querySelector("#urlInput");
inputBar.value =  'https://www.electronjs.org/docs/latest/tutorial/ipc'


const enterBtn = document.querySelector("#enterBtn");
enterBtn.addEventListener('click', () =>{
    window.webView.changeUrl(inputBar.value);
    inputBar.blur();
})

const backBtn = document.querySelector("#backBtn");
const fwdBtn = document.querySelector("#fwdBtn");

backBtn.addEventListener('click', () =>{
    window.webView.goBack();
    inputBar.blur();
})

fwdBtn.addEventListener('click', () =>{
    window.webView.goForward();
    inputBar.blur();
})

