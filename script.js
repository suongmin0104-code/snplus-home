let activeSlide = 0;
let slideTimer;
const DEFAULT_VIEW = "home";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasView(viewName) {
  return Array.from(document.querySelectorAll("[data-view]")).some((view) => view.dataset.view === viewName);
}

function normalizeView(viewName) {
  return hasView(viewName) ? viewName : DEFAULT_VIEW;
}

function getHashView() {
  return location.hash.replace("#", "") || DEFAULT_VIEW;
}

function showSlide(index) {
  const slides = document.querySelectorAll(".start-slide");
  const slideDots = document.querySelectorAll("[data-slide-target]");
  if (!slides.length) return;

  activeSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, slideIndex) => {
    slide.classList.toggle("active", slideIndex === activeSlide);
  });
  slideDots.forEach((dot, dotIndex) => {
    dot.classList.toggle("active", dotIndex === activeSlide);
  });
}

function startSlideTimer() {
  const slides = document.querySelectorAll(".start-slide");
  if (!slides.length || prefersReducedMotion) return;

  window.clearInterval(slideTimer);
  slideTimer = window.setInterval(() => {
    showSlide(activeSlide + 1);
  }, 4500);
}

function bindSlider() {
  document.querySelectorAll("[data-slide-target]").forEach((dot) => {
    dot.addEventListener("click", () => {
      showSlide(Number(dot.dataset.slideTarget));
      startSlideTimer();
    });
  });
  showSlide(0);
  startSlideTimer();
}

function showView(viewName) {
  const targetView = normalizeView(viewName);
  const viewLinks = document.querySelectorAll("[data-view-link]");
  const views = document.querySelectorAll("[data-view]");
  views.forEach((view) => {
    view.classList.toggle("active", view.dataset.view === targetView);
  });

  viewLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.viewLink === targetView);
  });

  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

function navigateToView(viewName) {
  const targetView = normalizeView(viewName);
  const targetHash = `#${targetView}`;

  if (location.hash !== targetHash) {
    location.hash = targetView;
    return;
  }

  showView(targetView);
}

function bindNavigation() {
  document.querySelectorAll("[data-view-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      closeDropdowns();
      navigateToView(link.dataset.viewLink);
    });
  });
}

function closeDropdowns() {
  document.querySelectorAll(".nav-group.open").forEach((group) => {
    group.classList.remove("open");
    const menu = group.querySelector(".mega-menu");
    const toggle = group.querySelector("[data-dropdown-toggle]");
    if (menu) {
      menu.hidden = true;
    }
    if (toggle) {
      toggle.setAttribute("aria-expanded", "false");
    }
  });
}

function bindDropdowns() {
  document.querySelectorAll("[data-dropdown-toggle]").forEach((toggle) => {
    const group = toggle.closest(".nav-group");
    const menu = group.querySelector(".mega-menu");
    toggle.setAttribute("aria-expanded", "false");
    if (menu) {
      menu.hidden = true;
    }

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = group.classList.contains("open");

      closeDropdowns();
      if (!isOpen) {
        group.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
        if (menu) {
          menu.hidden = false;
        }
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav")) {
      closeDropdowns();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDropdowns();
    }
  });
}

function bindCatalogFilters() {
  const catalogCards = document.querySelectorAll(".catalog-card");
  document.querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      document.querySelectorAll("[data-filter]").forEach((item) => item.classList.toggle("active", item === button));
      catalogCards.forEach((card) => {
        const visible = filter === "all" || card.dataset.kind === filter;
        card.classList.toggle("is-hidden", !visible);
      });
    });
  });
}

function initializePage() {
  bindSlider();
  bindNavigation();
  bindDropdowns();
  bindCatalogFilters();

  const initialView = getHashView();
  if (!hasView(initialView)) {
    location.replace("#home");
    return;
  }

  showView(initialView);
}

window.addEventListener("hashchange", () => {
  const nextView = getHashView();
  if (!hasView(nextView)) {
    location.replace("#home");
    return;
  }

  closeDropdowns();
  showView(nextView);
});

initializePage();
