function speak(text){
  const msg=new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(msg);
}

function startWorkout(){
  const bw=parseFloat(document.getElementById('bw').value)||0;
  const load=parseFloat(document.getElementById('load').value)||0;
  const exerciseLoad=(bw*0.7)+load;

  speak("3,2,1 go");
  document.getElementById('status').innerText="Exercise Load: "+exerciseLoad.toFixed(1)+"kg";
}
