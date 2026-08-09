let activeSlide = 0;
let slideTimer;
const DEFAULT_VIEW = "home";
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const CONTACT_COOLDOWN_MS = 5000;
const ATTRIBUTION_KEY = "snplus_attribution_v1";
let contactSubmitting = false;
let lastContactSubmitAt = 0;
let rootFormStarted = false;
let lastTrackedView = "";

function injectVercelAnalytics() {
  window.va = window.va || function () {
    (window.vaq = window.vaq || []).push(arguments);
  };

  if (!document.querySelector('script[src="/_vercel/insights/script.js"]')) {
    const script = document.createElement("script");
    script.src = "/_vercel/insights/script.js";
    script.defer = true;
    document.head.appendChild(script);
  }
}

function safeStorageGet(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function captureAttribution() {
  const params = new URLSearchParams(location.search);
  const previous = safeStorageGet(ATTRIBUTION_KEY) || {};
  const hasCampaign = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].some((key) => params.has(key));
  const current = {
    utmSource: params.get("utm_source") || "",
    utmMedium: params.get("utm_medium") || "",
    utmCampaign: params.get("utm_campaign") || "",
    utmTerm: params.get("utm_term") || "",
    utmContent: params.get("utm_content") || "",
    referrer: document.referrer || previous.referrer || "",
    landingPage: previous.landingPage || location.href,
    firstSeenAt: previous.firstSeenAt || new Date().toISOString()
  };
  const attribution = hasCampaign ? { ...previous, ...current, landingPage: location.href } : { ...current, ...previous };
  try {
    sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // The contact form still works when session storage is blocked.
  }
  return attribution;
}

function getSourceLabel(attribution) {
  if (attribution.utmSource) return attribution.utmSource.slice(0, 80);
  if (!attribution.referrer) return "direct";
  try {
    return new URL(attribution.referrer).hostname.slice(0, 80) || "referral";
  } catch {
    return "referral";
  }
}

function trackLeadEvent(name, placement = "homepage") {
  const attribution = captureAttribution();
  window.va?.("event", {
    name,
    data: {
      placement: String(placement).slice(0, 80),
      source: getSourceLabel(attribution)
    }
  });
}

function injectConversionTools() {
  if (!document.getElementById("sn-lead-style")) {
    const style = document.createElement("style");
    style.id = "sn-lead-style";
    style.textContent = `
      .sn-bollard-offer{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:14px;margin-top:18px;padding:15px 17px;border:1px solid rgba(255,255,255,.28);border-radius:13px;background:rgba(8,28,34,.72);color:#fff;backdrop-filter:blur(10px);transition:transform .18s ease,border-color .18s ease}
      .sn-bollard-offer:hover{transform:translateY(-2px);border-color:#e2a72e}
      .sn-bollard-offer>span:first-child{display:grid;place-items:center;width:43px;height:43px;border-radius:50%;background:#e2a72e;color:#1a160e;font-weight:900}
      .sn-bollard-offer strong{display:block;font-size:15px}.sn-bollard-offer small{display:block;margin-top:3px;color:rgba(255,255,255,.68);font-size:11px}.sn-bollard-offer b{color:#e2a72e;font-size:25px}
      .sn-lead-dock{position:fixed;z-index:250;right:22px;bottom:22px;display:grid;grid-template-columns:auto auto auto;overflow:hidden;border:1px solid rgba(255,255,255,.18);border-radius:14px;background:#0c1c22;color:#fff;box-shadow:0 16px 45px rgba(7,20,25,.28)}
      .sn-lead-dock a{min-height:50px;padding:0 17px;display:flex;align-items:center;justify-content:center;gap:7px;border-right:1px solid rgba(255,255,255,.12);font-size:12px;font-weight:800}.sn-lead-dock a:last-child{border-right:0}.sn-lead-dock .sn-dock-primary{background:#e2a72e;color:#17120a}
      @media(max-width:720px){body{padding-bottom:64px}.sn-bollard-offer{grid-template-columns:auto 1fr auto}.sn-lead-dock{right:0;bottom:0;left:0;grid-template-columns:.75fr 1.25fr 1fr;border:0;border-radius:0}.sn-lead-dock a{min-height:64px;padding:0 7px;font-size:11px}.sn-lead-dock a span{display:none}}
    `;
    document.head.appendChild(style);
  }

  const heroActions = document.querySelector(".home-hero-actions");
  if (heroActions && !document.querySelector(".sn-bollard-offer")) {
    const offer = document.createElement("a");
    offer.className = "sn-bollard-offer";
    offer.href = "/bollard";
    offer.dataset.leadTrack = "bollard_home_offer";
    offer.innerHTML = `<span aria-hidden="true">B</span><span><strong>볼라드 신규 설치·파손 교체가 필요하신가요?</strong><small>현장사진 2장, 지역, 수량으로 빠른 견적 상담</small></span><b aria-hidden="true">›</b>`;
    heroActions.insertAdjacentElement("afterend", offer);
  }

  if (!document.querySelector(".sn-lead-dock")) {
    const dock = document.createElement("div");
    dock.className = "sn-lead-dock";
    dock.setAttribute("aria-label", "빠른 상담 메뉴");
    dock.innerHTML = `
      <a href="tel:0318522918" data-lead-track="phone_dock"><span aria-hidden="true">☎</span>전화</a>
      <a href="https://pf.kakao.com/_YTUxnX" target="_blank" rel="noopener" data-lead-track="kakao_dock"><span aria-hidden="true">K</span>카카오</a>
      <a class="sn-dock-primary" href="/bollard" data-lead-track="bollard_dock"><span aria-hidden="true">▣</span>볼라드 사진견적</a>
    `;
    document.body.appendChild(dock);
  }
}

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
  slideTimer = window.setInterval(() => showSlide(activeSlide + 1), 4500);
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
  views.forEach((view) => view.classList.toggle("active", view.dataset.view === targetView));
  viewLinks.forEach((link) => link.classList.toggle("active", link.dataset.viewLink === targetView));
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });

  if (targetView !== lastTrackedView) {
    lastTrackedView = targetView;
    trackLeadEvent("Homepage Section Viewed", targetView);
  }
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
    if (menu) menu.hidden = true;
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  });
}

function bindDropdowns() {
  document.querySelectorAll("[data-dropdown-toggle]").forEach((toggle) => {
    const group = toggle.closest(".nav-group");
    const menu = group.querySelector(".mega-menu");
    toggle.setAttribute("aria-expanded", "false");
    if (menu) menu.hidden = true;

    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      const isOpen = group.classList.contains("open");
      closeDropdowns();
      if (!isOpen) {
        group.classList.add("open");
        toggle.setAttribute("aria-expanded", "true");
        if (menu) menu.hidden = false;
      }
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".nav")) closeDropdowns();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeDropdowns();
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
    userAgent: navigator.userAgent,
    ...captureAttribution()
  };
}

function bindEstimateForm() {
  const form = document.querySelector("[data-contact-form]");
  if (!form) return;
  const submitButton = form.querySelector("[data-contact-submit]");
  const defaultButtonText = submitButton?.textContent ?? "문의 접수하기";

  form.addEventListener("input", () => {
    if (!rootFormStarted) {
      rootFormStarted = true;
      trackLeadEvent("Quote Form Started", "homepage_form");
    }
  }, { once: true });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (contactSubmitting) return;

    const now = Date.now();
    if (lastContactSubmitAt && now - lastContactSubmitAt < CONTACT_COOLDOWN_MS) {
      setContactStatus(form, "error", "잠시 후 다시 전송해 주세요.");
      return;
    }

    const payload = validateContactForm(form);
    if (!payload) return;

    contactSubmitting = true;
    trackLeadEvent("Quote Submit Started", "homepage_form");
    setContactStatus(form, "", "전송 중입니다...");
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "전송 중입니다...";
    }

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || "CONTACT_FAILED");

      form.reset();
      lastContactSubmitAt = Date.now();
      trackLeadEvent("Quote Submitted", "homepage_form");
      const leadText = result.leadId ? ` 접수번호: ${result.leadId}` : "";
      setContactStatus(form, "success", `문의가 정상적으로 접수되었습니다.${leadText} 담당자가 확인 후 연락드리겠습니다.`);
    } catch (error) {
      trackLeadEvent("Quote Submit Failed", "homepage_form");
      const message = error instanceof Error && error.message && error.message !== "CONTACT_FAILED"
        ? error.message
        : "문의 접수에 실패했습니다. 031-852-2918 또는 sn6221@naver.com으로 연락 부탁드립니다.";
      setContactStatus(form, "error", message);
    } finally {
      contactSubmitting = false;
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = defaultButtonText;
      }
    }
  });
}

function bindLeadTracking() {
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a, button");
    if (!link) return;
    const href = link.getAttribute("href") || "";
    const placement = link.dataset.leadTrack || link.dataset.viewLink || href.slice(0, 70) || "button";

    if (href.startsWith("tel:")) trackLeadEvent("Phone Clicked", placement);
    else if (href.includes("pf.kakao.com")) trackLeadEvent("Kakao Clicked", placement);
    else if (href === "/bollard" || href.startsWith("/bollard?")) trackLeadEvent("Bollard Landing Clicked", placement);
    else if (href.toLowerCase().includes(".pdf")) trackLeadEvent("Document Opened", placement);
    else if (link.dataset.viewLink === "estimate" || link.dataset.viewLink === "contact") trackLeadEvent("Quote CTA Clicked", placement);
  });
}

function initializePage() {
  injectVercelAnalytics();
  captureAttribution();
  injectConversionTools();
  bindSlider();
  bindNavigation();
  bindDropdowns();
  bindCatalogFilters();
  bindEstimateForm();
  bindLeadTracking();

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
