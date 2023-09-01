//this file is used for the homepage to add all the game cards

const UE4Widget = document.getElementById("unreal-engine-4-cards");
const UE5Widget = document.getElementById("unreal-engine-5-cards");
const UnityWidget = document.getElementById("unity-cards");

const currentPath = "Games/";

fetch(currentPath + "GameList.json")
  .then((response) => response.json())
  .then((data) => {
    const gamesArray = data.games;

    gamesArray.forEach((game) => {
      const box = document.createElement("a");
      box.classList.add(
        "bg-slate-700/10",
        "overflow-hidden",
        "rounded-lg",
        "ring-1",
        "ring-slate-500/10",
        "shadow-sm",
        "transition",
        "duration-300",
        "ease-in-out",
        "hover:shadow-md"
      );
      box.href = currentPath + game.engine + "/" + game.location;
      const img = document.createElement("img");
      img.src = box.href + "/image.jpg";
      img.alt = "missing image.jpg";
      box.appendChild(img);

      const descriptionDiv = document.createElement("div");
      descriptionDiv.classList.add("px-4", "py-2");

      const title = document.createElement("p");
      title.classList.add("font-semibold", "text-lg");
      title.textContent = game.name;
      descriptionDiv.appendChild(title);

      const bottomLineDiv = document.createElement("div");
      bottomLineDiv.classList.add("flex", "justify-between");

      const creditDiv = document.createElement("div");
      creditDiv.classList.add("flex", "space-x-1");

      const byPara = document.createElement("p");
      byPara.classList.add("text-sm");
      byPara.textContent = "By";

      const namePara = document.createElement("p");
      namePara.classList.add("text-sm", "font-semibold");
      namePara.textContent = game.uploader.name;

      creditDiv.appendChild(byPara);
      creditDiv.appendChild(namePara);

      bottomLineDiv.appendChild(creditDiv);

      descriptionDiv.appendChild(bottomLineDiv);

      const timeDiv = document.createElement("div");
      timeDiv.classList.add("flex", "items-center", "space-x-1");

      const svgElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );

      svgElement.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      svgElement.classList.add("w-4", "h-4");
      svgElement.setAttribute("viewBox", "0 0 24 24");
      svgElement.setAttribute("fill", "none");

      // Create a path element
      const pathElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      // Set the attributes for the path element
      pathElement.setAttribute(
        "d",
        "M12 7V12H15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
      );
      pathElement.setAttribute("stroke", "#000000");
      pathElement.setAttribute("stroke-width", "2");
      pathElement.setAttribute("stroke-linecap", "round");
      pathElement.setAttribute("stroke-linejoin", "round");

      // Append the path element to the SVG element
      svgElement.appendChild(pathElement);

      let timePara = document.createElement("p");
      timePara.classList.add("text-sm");
      timePara = formatElapsedTime(Date.now(), game.uploaded, timePara);

      timeDiv.appendChild(svgElement);
      timeDiv.appendChild(timePara);

      bottomLineDiv.appendChild(timeDiv);

      box.appendChild(descriptionDiv);

      if (game.engine == "Unreal-Engine-5") {
        UE5Widget.appendChild(box);
      } else if (game.engine == "Unreal-Engine-4") {
        UE4Widget.appendChild(box);
      } else if (game.engine == "Unity") {
        UnityWidget.appendChild(box);
      }
    });
  })
  .catch((error) => console.error("Error fetching or parsing JSON:", error));

function formatElapsedTime(currentTime, givenTime, elem) {
  const timeElapsed = currentTime - givenTime;
  const secondsInMilli = 1000;
  const minutesInMilli = 60 * secondsInMilli;
  const hoursInMilli = 60 * minutesInMilli;
  const daysInMilli = 24 * hoursInMilli;
  const weeksInMilli = 7 * daysInMilli;
  const monthsInMilli = 30 * daysInMilli;
  const yearsInMilli = 365 * daysInMilli;

  let timeElapsedString = "";

  if (timeElapsed < minutesInMilli) {
    const val = Math.floor(timeElapsed / secondsInMilli);
    timeElapsedString = val + " second" + (val > 1 ? "s" : "");
  } else if (timeElapsed < hoursInMilli) {
    const val = Math.floor(timeElapsed / minutesInMilli);
    timeElapsedString = val + " minute" + (val > 1 ? "s" : "");
  } else if (timeElapsed < daysInMilli) {
    const val = Math.floor(timeElapsed / hoursInMilli);
    timeElapsedString = val + " hour" + (val > 1 ? "s" : "");
  } else if (timeElapsed < weeksInMilli) {
    const val = Math.floor(timeElapsed / daysInMilli);
    timeElapsedString = val + " day" + (val > 1 ? "s" : "");
  } else if (timeElapsed < monthsInMilli) {
    const val = Math.floor(timeElapsed / weeksInMilli);
    timeElapsedString = val + " week" + (val > 1 ? "s" : "");
  } else if (timeElapsed < yearsInMilli) {
    const val = Math.floor(timeElapsed / monthsInMilli);
    timeElapsedString = val + " month" + (val > 1 ? "s" : "");
    if (val >= 1) {
      if (val >= 6) {
        elem.classList.add("text-red-500");
      } else {
        elem.classList.add("text-amber-500");
      }
    }
  } else {
    const years = Math.floor(timeElapsed / yearsInMilli);
    timeElapsedString = years + " year" + (years > 1 ? "s" : "");
    elem.classList.add("text-red-500");
  }
  elem.textContent = timeElapsedString + " ago";
  return elem;
}
