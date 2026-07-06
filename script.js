let activeSlide = 0;
let slideTimer;
const DEFAULT_VIEW = "home";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const CONTACT_COOLDOWN_MS = 5000;
let contactSubmitting = false;
let lastContactSubmitAt = 0;

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

function getFormValue(form, name) {
  return form.elements[name]?.value?.trim() ?? "";
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 12 && /^[0-9+\-().\s]+$/.test(value);
}

function isValidEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function setContactStatus(form, type, message) {
  const status = form.querySelector("[data-contact-status]");
  if (!status) return;

  status.className = `form-status ${type || ""}`.trim();
  status.textContent = message;
  status.setAttribute("role", type === "error" ? "alert" : "status");
}

function validateContactForm(form) {
  const requiredFields = [
    ["companyName", "회사명을 입력해 주세요."],
    ["contactName", "담당자명을 입력해 주세요."],
    ["phone", "연락처를 입력해 주세요."],
    ["message", "문의 내용을 입력해 주세요."]
  ];

  for (const [name, message] of requiredFields) {
    const field = form.elements[name];
    if (!getFormValue(form, name)) {
      setContactStatus(form, "error", message);
      field?.focus();
      return null;
    }
  }

  const phone = getFormValue(form, "phone");
  if (!isValidPhone(phone)) {
    setContactStatus(form, "error", "연락처 형식을 확인해 주세요.");
    form.elements.phone?.focus();
    return null;
  }

  const email = getFormValue(form, "email");
  if (!isValidEmail(email)) {
    setContactStatus(form, "error", "이메일 형식을 확인해 주세요.");
    form.elements.email?.focus();
    return null;
  }

  if (!form.elements.privacyConsent?.checked) {
    setContactStatus(form, "error", "개인정보 수집 및 이용에 동의해 주세요.");
    form.elements.privacyConsent?.focus();
    return null;
  }

  return {
    companyName: getFormValue(form, "companyName"),
    contactName: getFormValue(form, "contactName"),
    phone,
    email,
    inquiryType: getFormValue(form, "inquiryType"),
    subject: getFormValue(form, "subject"),
    message: getFormValue(form, "message"),
    privacyConsent: true,
    website: getFormValue(form, "website"),
    pageUrl: location.href,
    siteUrl: location.origin,
    userAgent: navigator.userAgent
  };
}

function bindEstimateForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;

  const submitButton = form.querySelector("[data-contact-submit]");
  const defaultButtonText = submitButton?.textContent ?? "문의 접수하기";

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (contactSubmitting) {
      return;
    }

    const now = Date.now();
    if (lastContactSubmitAt && now - lastContactSubmitAt < CONTACT_COOLDOWN_MS) {
      setContactStatus(form, "error", "잠시 후 다시 전송해 주세요.");
      return;
    }

    const payload = validateContactForm(form);
    if (!payload) {
      return;
    }

    contactSubmitting = true;
    setContactStatus(form, "", "전송 중입니다...");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "전송 중입니다...";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("Contact request failed");
      }

      form.reset();
      lastContactSubmitAt = Date.now();
      setContactStatus(form, "success", "문의가 정상적으로 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.");
    } catch {
      setContactStatus(form, "error", "문의 접수에 실패했습니다. 031-852-2918 또는 sn6221@naver.com 으로 연락 부탁드립니다.");
    } finally {
      contactSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}

function initializePage() {
  bindSlider();
  bindNavigation();
  bindDropdowns();
  bindCatalogFilters();
  bindEstimateForm();

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
