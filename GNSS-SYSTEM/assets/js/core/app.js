/* =========================================================
   GPMS CORE  -  shared behaviour for every page
   ========================================================= */

/** Open / close the sidebar on small screens. */
function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("open");
}

/** Exit the monitoring toolkit and return to the home page. */
function handleExit() {
  if (confirm("Are you sure you want to exit?")) {
    window.RxLogger && RxLogger.info("User exited to home page");
    const home = location.pathname.includes("/pages/") ? "../index.html" : "index.html";
    window.location.href = home;
  }
}

/** Highlight the sidebar link that matches the current page. */
document.addEventListener("DOMContentLoaded", () => {
  const path = location.pathname.replace(/\\/g, "/");
  document.querySelectorAll(".nav-item").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && path.endsWith(href.replace("../", "/"))) {
      a.classList.add("active");
    }
  });
});
