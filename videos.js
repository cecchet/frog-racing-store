// The Frog Racing YouTube logo shown on a product that has related videos (store cards and the
// Recommended page). One video: the logo links straight to it. Several: it opens a short list.
// A product's videos are [{ id, title }] with the YouTube video id.

const FROG_YOUTUBE_ICON = "images/frog-youtube.jpg";

function frogVideoEsc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function frogCloseVideoMenus(except) {
  for (const menu of document.querySelectorAll(".rec-video-menu")) {
    if (menu === except) continue;
    menu.hidden = true;
    const button = menu.previousElementSibling;
    if (button) button.setAttribute("aria-expanded", "false");
  }
}

document.addEventListener("click", () => frogCloseVideoMenus());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") frogCloseVideoMenus();
});

// The elements to place in a positioned container: the logo link, or the logo button + its list.
function frogVideoControls(videos) {
  const icon = `<img src="${FROG_YOUTUBE_ICON}" alt="" width="32" height="25" loading="lazy">`;
  if (videos.length === 1) {
    const label = `Watch on the Frog Racing YouTube channel: ${videos[0].title}`;
    const link = document.createElement("a");
    link.className = "rec-video";
    link.href = `https://www.youtube.com/watch?v=${videos[0].id}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = label;
    link.setAttribute("aria-label", label);
    link.innerHTML = icon;
    return [link];
  }

  const label = `${videos.length} related videos on the Frog Racing YouTube channel`;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "rec-video";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = icon;

  const menu = document.createElement("div");
  menu.className = "rec-video-menu";
  menu.hidden = true;
  menu.innerHTML = videos
    .map((v) => `<a href="https://www.youtube.com/watch?v=${frogVideoEsc(v.id)}" target="_blank" rel="noopener">${frogVideoEsc(v.title)}</a>`)
    .join("");
  menu.addEventListener("click", (e) => e.stopPropagation());

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    const opening = menu.hidden;
    frogCloseVideoMenus(menu);
    menu.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
  });
  return [button, menu];
}
