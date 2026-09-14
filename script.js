

/* =========================================================
   INFINITE VERTICAL-CARD CAROUSEL
   ========================================================= */

const testimonialTrack =
  document.getElementById("testimonialTrack");

const testimonialSlider =
  document.getElementById("testimonialSlider");

const testimonialNext =
  document.getElementById("testimonialNext");

const testimonialPrev =
  document.getElementById("testimonialPrev");

const testimonialDots =
  document.getElementById("testimonialDots");


/*
  Four original cards + four duplicated cards.
*/

const originalCount = 4;

let position = 0;

let isPaused = false;

let isDragging = false;

let dragStartX = 0;

let dragStartPosition = 0;

let lastTime = performance.now();


/* Automatic speed */

const autoSpeed = 0.035;


/* =========================================================
   CARD WIDTH
   ========================================================= */

function getCardWidth(){

  const card =
    testimonialTrack.querySelector(
      ".testimonial-card"
    );

  if(!card){
    return 324;
  }

  const styles =
    window.getComputedStyle(
      testimonialTrack
    );

  const gap =
    parseFloat(styles.gap) || 0;

  return card.offsetWidth + gap;

}


/* =========================================================
   LOOP WIDTH
   ========================================================= */

function getLoopWidth(){

  return getCardWidth() * originalCount;

}


/* =========================================================
   NORMALIZE
   ========================================================= */

function normalizePosition(){

  const loopWidth =
    getLoopWidth();


  while(position >= loopWidth){

    position -= loopWidth;

  }


  while(position < 0){

    position += loopWidth;

  }

}


/* =========================================================
   RENDER
   ========================================================= */

function render(){

  testimonialTrack.style.transform =
    `translate3d(${-position}px,0,0)`;

}


/* =========================================================
   DOTS
   ========================================================= */

for(let i = 0; i < originalCount; i++){

  const dot =
    document.createElement("button");

  dot.type =
    "button";

  dot.className =
    "testimonial-dot";

  dot.setAttribute(
    "aria-label",
    `View testimonial ${i + 1}`
  );

  dot.addEventListener(
    "click",
    ()=>{
      goToSlide(i);
    }
  );

  testimonialDots.appendChild(dot);

}


const testimonialDotItems =
  Array.from(
    testimonialDots.children
  );


function updateDots(){

  const width =
    getCardWidth();

  let index =
    Math.round(
      position / width
    ) % originalCount;


  if(index < 0){

    index += originalCount;

  }


  testimonialDotItems.forEach(
    (dot,i)=>{

      dot.classList.toggle(
        "active",
        i === index
      );

    }
  );

}


/* =========================================================
   GO TO
   ========================================================= */

function goToSlide(index){

  position =
    index * getCardWidth();

  normalizePosition();

  render();

  updateDots();

}


/* =========================================================
   NEXT
   ========================================================= */

function nextSlide(){

  position +=
    getCardWidth();

  normalizePosition();

  render();

  updateDots();

}


/* =========================================================
   PREVIOUS
   ========================================================= */

function previousSlide(){

  position -=
    getCardWidth();

  normalizePosition();

  render();

  updateDots();

}


/* =========================================================
   CONTINUOUS MOTION
   ========================================================= */

function animate(time){

  const delta =
    time - lastTime;

  lastTime =
    time;


  if(
    !isPaused &&
    !isDragging
  ){

    position +=
      autoSpeed * delta;

    normalizePosition();

    render();

    updateDots();

  }


  requestAnimationFrame(
    animate
  );

}


/* =========================================================
   BUTTONS
   ========================================================= */

testimonialNext.addEventListener(
  "click",
  ()=>{
    nextSlide();
  }
);


testimonialPrev.addEventListener(
  "click",
  ()=>{
    previousSlide();
  }
);


/* =========================================================
   HOVER PAUSE
   ========================================================= */

testimonialSlider.addEventListener(
  "mouseenter",
  ()=>{
    isPaused = true;
  }
);


testimonialSlider.addEventListener(
  "mouseleave",
  ()=>{
    isPaused = false;
  }
);


/* =========================================================
   TOUCH SWIPE
   ========================================================= */

testimonialSlider.addEventListener(
  "touchstart",
  event=>{

    isDragging = true;

    dragStartX =
      event.touches[0].clientX;

    dragStartPosition =
      position;

  },
  {
    passive:true
  }
);


testimonialSlider.addEventListener(
  "touchmove",
  event=>{

    if(!isDragging){
      return;
    }

    const currentX =
      event.touches[0].clientX;

    const distance =
      dragStartX -
      currentX;

    position =
      dragStartPosition +
      distance;

    normalizePosition();

    render();

  },
  {
    passive:true
  }
);


testimonialSlider.addEventListener(
  "touchend",
  event=>{

    if(!isDragging){
      return;
    }

    const endX =
      event.changedTouches[0].clientX;

    const distance =
      dragStartX -
      endX;

    isDragging = false;


    if(Math.abs(distance) > 50){

      if(distance > 0){

        nextSlide();

      }else{

        previousSlide();

      }

    }

  },
  {
    passive:true
  }
);


/* =========================================================
   MOUSE DRAG
   ========================================================= */

testimonialSlider.addEventListener(
  "mousedown",
  event=>{

    isDragging = true;

    dragStartX =
      event.clientX;

    dragStartPosition =
      position;

  }
);


window.addEventListener(
  "mousemove",
  event=>{

    if(!isDragging){
      return;
    }

    const distance =
      dragStartX -
      event.clientX;

    position =
      dragStartPosition +
      distance;

    normalizePosition();

    render();

  }
);


window.addEventListener(
  "mouseup",
  event=>{

    if(!isDragging){
      return;
    }

    const distance =
      dragStartX -
      event.clientX;

    isDragging = false;


    if(Math.abs(distance) > 50){

      if(distance > 0){

        nextSlide();

      }else{

        previousSlide();

      }

    }

  }
);


/* =========================================================
   KEYBOARD
   ========================================================= */

document.addEventListener(
  "keydown",
  event=>{

    if(event.key === "ArrowRight"){

      nextSlide();

    }

    if(event.key === "ArrowLeft"){

      previousSlide();

    }

  }
);


/* =========================================================
   RESIZE
   ========================================================= */

window.addEventListener(
  "resize",
  ()=>{
    normalizePosition();

    render();

  }
);


/* =========================================================
   START
   ========================================================= */

goToSlide(0);

requestAnimationFrame(
  animate
);

