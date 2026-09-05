document.addEventListener("DOMContentLoaded", () => {
  const toc = document.querySelector("[data-page-toc]");
  const headings = [...document.querySelectorAll(".article-body h2, .document-content h2")];

  if (!toc || headings.length === 0) {
    document.querySelector(".page-toc")?.classList.add("is-empty");
    return;
  }

  headings.forEach((heading, index) => {
    if (!heading.id) heading.id = `section-${index + 1}`;

    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    toc.appendChild(link);
  });
});
