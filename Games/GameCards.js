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
      const dataPath = currentPath + game.engine + "/" + game.location;
      box.href = currentPath + "?hash=" + game.hash;
      const img = document.createElement("img");
      img.src = dataPath + "/image.jpg";
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
