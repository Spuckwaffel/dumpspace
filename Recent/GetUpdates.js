const UpdateList = document.getElementById("updateList");

async function getUpdates() {
  const updatesArray = (await (await fetch("GameUpdates.json")).json()).updates;

  const gameList = (await (await fetch("../Games/GameList.json")).json()).games;

  function getGame(hash) {
    for (i in gameList) {
      var game = gameList[i];
      if (game.hash === hash) {
        const link = "Games/" + "?hash=" + game.hash;
        return [game.name, link];
      }
    }
    return null;
  }

  function convertToTimestamp(milliseconds) {
    // Create a new Date object using the milliseconds
    var date = new Date(milliseconds);

    // Get the day, month, year, hours, and minutes
    var day = date.getDate();
    var month = date.getMonth() + 1; // Months are zero-based
    var year = date.getFullYear();
    var hours = date.getHours();
    var minutes = date.getMinutes();

    // Add leading zeros if necessary
    day = day < 10 ? "0" + day : day;
    month = month < 10 ? "0" + month : month;
    hours = hours < 10 ? "0" + hours : hours;
    minutes = minutes < 10 ? "0" + minutes : minutes;

    // Construct the timestamp string
    var timestamp =
      day + "/" + month + "/" + year + " " + hours + ":" + minutes;

    return timestamp;
  }

  const maxItems = 50;
  var item = 0;

  updatesArray.forEach((update) => {
    if (item > maxItems) return;
    var li = document.createElement("li");
    li.classList.add("mb-10", "ml-4");

    // Create the inner div element
    var innerDiv = document.createElement("div");
    innerDiv.classList.add(
      "absolute",
      "w-3",
      "h-3",
      "bg-gray-200",
      "rounded-full",
      "mt-1.5",
      "-left-1.5",
      "border",
      "border-white"
    );
    li.appendChild(innerDiv);

    // Create the time element
    var time = document.createElement("time");
    time.classList.add(
      "mb-1",
      "text-sm",
      "font-normal",
      "leading-none",
      "text-slate-600",
      "dark:text-slate-400"
    );
    time.textContent = convertToTimestamp(update.uploaded);
    li.appendChild(time);

    const game = getGame(update.hash);
    if (game === null) return;

    const name = game[0];
    const url = rootURL() + "/" + game[1];

    // Create the heading element
    var headingDiv = document.createElement("div");
    headingDiv.classList.add(
      "text-slate-900",
      "dark:text-slate-100",
      "flex",
      "items-center",
      "space-x-2"
    );

    if (update.type === "Added") {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "25px");
      svg.setAttribute("height", "25px");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.classList.add("text-green-500");
      // Create the group element
      var group = document.createElementNS("http://www.w3.org/2000/svg", "g");

      // Create the path element
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        "M8 12H12M12 12H16M12 12V16M12 12V8M12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21Z"
      );
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");

      // Append path to group
      group.appendChild(path);

      // Append group to SVG
      svg.appendChild(group);
      headingDiv.appendChild(svg);
    } else {
      var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "25px");
      svg.setAttribute("height", "25px");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "none");
      svg.classList.add("text-amber-500");

      // Create the path element
      var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "d",
        "M20.9844 10H17M20.9844 10V6M20.9844 10L17.6569 6.34315C14.5327 3.21895 9.46734 3.21895 6.34315 6.34315C3.21895 9.46734 3.21895 14.5327 6.34315 17.6569C9.46734 20.781 14.5327 20.781 17.6569 17.6569C18.4407 16.873 19.0279 15.9669 19.4184 15M12 9V13L15 14.5"
      );
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "2");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");

      // Append path to SVG
      svg.appendChild(path);

      headingDiv.appendChild(svg);
    }
    var heading = document.createElement("a");
    heading.classList.add("text-lg", "font-semibold", "hover:text-blue-500");
    heading.textContent = update.type + " " + name;
    heading.href = url;
    headingDiv.appendChild(heading);
    li.appendChild(headingDiv);

    var paragraphDiv = document.createElement("div");
    paragraphDiv.classList.add("flex", "text-gray-500", "dark:text-gray-400");

    var uploadcredit = document.createElement("a");
    uploadcredit.textContent = update.uploader.name;
    uploadcredit.classList.add(
      "text-base",
      "font-semibold",
      "hover:text-blue-500",
      "pr-2"
    );
    uploadcredit.href = update.uploader.link;

    paragraphDiv.appendChild(uploadcredit);
    // Create the paragraph element
    var paragraph = document.createElement("p");
    paragraph.classList.add(
      "text-base",
      "font-normal",
      "text-gray-500",
      "dark:text-gray-400"
    );
    paragraph.textContent = update.type.toLowerCase() + " " + name + ".";
    paragraphDiv.appendChild(paragraph);

    li.appendChild(paragraphDiv);

    UpdateList.appendChild(li);
    item++;
  });
}

getUpdates();
