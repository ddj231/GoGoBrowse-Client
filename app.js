const func = async () => {
}
  
window.webView
      .changeUrl('https://www.electronjs.org/docs/latest/tutorial/ipc');

const inputBar = document.querySelector("#urlInput");
inputBar.value =  'https://www.electronjs.org/docs/latest/tutorial/ipc'

document.addEventListener('keyup', (event) => {
    console.log("key up");
    if(event.code == 'Enter') {
        console.log("enter pressed");
        //enter pressed
        if(inputBar === document.activeElement){
            window.webView.changeUrl(inputBar.value);
            inputBar.blur();
        }
    }
});

const backBtn = document.querySelector("#backBtn");
const fwdBtn = document.querySelector("#fwdBtn");
const refreshBtn = document.querySelector("#refreshBtn");

backBtn.addEventListener('click', () =>{
    window.webView.goBack();
})

fwdBtn.addEventListener('click', () =>{
    window.webView.goForward();
})

refreshBtn.addEventListener('click', () =>{
    window.webView.refresh();
})

window.webView.handleURLChange((_, value) => {
    inputBar.value = value;
    inputBar.blur();
});