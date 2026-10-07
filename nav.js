// Phone-width menu: it is a single swipeable row, so fade the right edge while there is
// more to scroll to, and bring the current page's entry into view.
(function () {
  const nav = document.getElementById("category-nav");
  if (!nav) return;

  const update = () => {
    const more = nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 2;
    nav.classList.toggle("nav-more", more);
  };

  const current = nav.querySelector("a.current");
  if (current && nav.scrollWidth > nav.clientWidth) {
    nav.scrollLeft = current.offsetLeft - nav.offsetLeft - 16;
  }

  nav.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
