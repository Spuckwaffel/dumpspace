<h1>Dumpspace</h1>
<p>The official Dumpspace website and GitHub to get the latest updates and offsets for your game.</p>
<p>This website allows anyone to upload or update their game following a few simple steps.</p>
<h3>Features:</h3>
<ol>
<li>3 Different engine types</li>
<li>Creating and viewing your own games</li>
<li>Fast and lightweight website that uses caching</li>
<li>No lag no matter how large the game is</li>
<li>Support for Structs, Classes, Functions, Enums and Offsets</li>
<li>Open source!</li>
</ol>
<h2>Viewing The Website</h2>
<p>The website can be viewed by visiting <a href="https://dumpspace.spuckwaffel.com">https://dumpspace.spuckwaffel.com</a> which just showcases the GitHub repository as a website. The website itself is static and does not need any server to run.</p>
<p>&nbsp;</p>
<h2>Adding Your Game</h2>
<p>You want to add your game? - Sure, it's very easy.</p>
<p>Watch the video <a href="https://youtu.be/urUdnCld1rY">here</a> or follow the steps below.</p>
<ol>
<li>Fork the GitHub so you can create a pull request with your files.</li>
<li>Get the <a href="https://github.com/Spuckwaffel/UEDumper">UEDumper</a> or use the <a href="https://github.com/Spuckwaffel/Dumpspace-Gen">Dumpspace Gen library</a> to generate the Dumpspace JSON files.</li>
<li>Add the files into a folder in Game/&lt;engine&gt;/&lt;game-name&gt; where the engine folder can have the following names:<br />
<ul>
<li>Unity</li>
<li>Unreal-Engine-3</li>
<li>Unreal-Engine-4</li>
<li>Unreal-Engine-5</li>
</ul>
</li>
<li>The &lt;game-name&gt; folder should be the Games' name, however instead of using spaces " ", use "-", e.g "Counter Strike" &rarr; "Counter-Strike".</li>
<li>The Games' folder should contain the 5 generated JSON files and contain one&nbsp;<span style="text-decoration: underline;"><strong>image.jpg</strong></span> file. The image.jpg file is for the thumbnail on the home website. Use and image.jpg that is related to the game. Use a simple google search and get the first JPG file.</li>
<li>Commit the 6 files and create a pull request. The pull request should only contain these 6 files! The pull request should get automatically merged by the bot if you followed these exact steps.</li>
<li>View your new game on the website.</li>
</ol>
<p>&nbsp;</p>
<h2>Updating Your Game</h2>
<p>Updating your game is almost the same as adding a new game. Instead of adding the JSON files and an image.JPG file, just replace the JSON files. You can optionally update the image, but it isn't required.</p>
<p>The website might take 5 minutes to display the changes due to your browsers' caching.</p>
<p>&nbsp;</p>
<h2>Contributing</h2>
<p>The website was the first website I've ever written, I never touched HTML, JS and CSS before. This is why this website doesn't use a framework and all the code is handwritten. It might contain a few bugs or just bad code, but feel free to upgrade it. The website itself is in a very early stage and before making large changes, please contact me for questions.</p>
<p>&nbsp;</p>
<h2>Special Thanks</h2>
<p>Special thanks to Blue fire for countless tips while I made this website.</p>
<p>Also, special thanks to <a href="https://github.com/winetree94/VanillaRecyclerView">VanillaRecyclerView</a> which gets rid of all the lag when having Grids with thousands of items.&nbsp;</p>
<p><a href="https://tailwindcss.com/">https://tailwindcss.com/</a> and <a href="https://icons8.com/">https://icons8.com/</a> were used in this project.</p>

<p>Join the discord for more info and questions <a href="https://discord.gg/XZAqYVhpjm">here</a>.</p>
