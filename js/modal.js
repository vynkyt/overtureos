// MUST BE PLACED AT BOTTOM OF HTML PAGE //

// SET CLASS TO "PROVERB" OR "COMPLIMENT" //

///////////////////////////////////////////

// Grab all compliment elements on the page
const complimentElements = document.querySelectorAll('.compliment');

// Convert NodeList to array of text contents
const compliments = Array.from(complimentElements).map(el => el.textContent.trim());

// Function to show modal
function showCompliment() {
  const random = compliments[Math.floor(Math.random() * compliments.length)];
  document.getElementById('complimentText').innerText = random;
  document.getElementById('complimentModal').style.display = "flex";
}

// Close modal
function closecModal() {
  document.getElementById('complimentModal').style.display = "none";
}

window.onload = function () { 
    document.getElementById('complimentModal').style.display = "none";
};

// Grab all compliment elements on the page
const proverbElements = document.querySelectorAll('.proverb');

// Convert NodeList to array of text contents
const proverbs = Array.from(proverbElements).map(el => el.textContent.trim());

// Function to show modal
function showProverb() {
  const random = proverbs[Math.floor(Math.random() * proverbs.length)];
  document.getElementById('proverbText').innerText = random;
  document.getElementById('proverbModal').style.display = "flex";
}

// Close modal
function closepModal() {
  document.getElementById('proverbModal').style.display = "none";
}

window.onload = function () { 
    document.getElementById('proverbModal').style.display = "none";
};
