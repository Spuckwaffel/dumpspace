// script.js

document.getElementById("searchButton").addEventListener("click", function() {
    alert("Button clicked!");
    // You can add your own script logic here
});

document.getElementById("getStartedButton").addEventListener("click", function() {
    alert("Button clicked!");
    // You can add your own script logic here
});

const wordRow = document.getElementById('wordRow');

fetch('items.json')
    .then(response => response.json())
    .then(data => {
        const wordsArray = data.words;

        wordsArray.forEach(word => {
            const wordSpan = document.createElement('span');
            wordSpan.textContent = word + ' ';
            wordRow.appendChild(wordSpan);
        });
    })
    .catch(error => console.error('Error fetching or parsing JSON:', error));
