const projectDirectory = new URL("./Projects/", window.location.href);
const homePage = new URL("../../index.html", projectDirectory);
const projectStatuses = ["WIP", "Published", "Concept", "Blocked"];
const resultsList = document.getElementById("project-results");
const searchStatus = document.getElementById("project-search-status");
const searchInput = document.getElementById("project-query");
let projects = [];
let isLoading = true;

function renderResults(query = "") {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const matchingProjects = projects.filter(project =>
        project.searchText.toLocaleLowerCase().includes(normalizedQuery)
    );

    resultsList.replaceChildren();
    matchingProjects.forEach(project => {
        const item = document.createElement("div");
        const link = document.createElement("a");
        link.href = project.url.href;
        link.textContent = project.title;
        const status = document.createElement("span");
        status.className = `project-status project-status--${project.status.toLocaleLowerCase()}`;
        status.textContent = project.status;
        status.setAttribute("aria-label", `Status: ${project.status}`);
        item.append(link);
        item.append(" ", status);

        if (project.description) {
            const description = document.createElement("p");
            description.textContent = project.description;
            item.append(description);
        }

        resultsList.append(item);
    });

    if (isLoading) {
        searchStatus.textContent = "Loading projects...";
        return;
    }

    if (matchingProjects.length === 0) {
        searchStatus.textContent = projects.length === 0
            ? "No project pages have been added yet."
            : "No projects match your search.";
    } else {
        searchStatus.textContent = `${matchingProjects.length} project${matchingProjects.length === 1 ? "" : "s"} found.`;
    }
}

async function loadProjects() {
    const indexResponse = await fetch(new URL("projects.json", projectDirectory));
    if (!indexResponse.ok) {
        throw new Error(`Could not load the project index (${indexResponse.status}).`);
    }

    const index = await indexResponse.json();
    if (!Array.isArray(index.projects) || !index.projects.every(project =>
        project && typeof project.title === "string" &&
        typeof project.description === "string" &&
        typeof project.link === "string" &&
        typeof project.status === "string" &&
        projectStatuses.some(status => status.toLocaleLowerCase() === project.status.toLocaleLowerCase())
    )) {
        throw new Error("The project index must contain projects with a title, description, link, and a valid status (WIP, Published, Concept, or Blocked).");
    }

    projects = await Promise.all(index.projects.map(async project => {
        const url = new URL(project.link, projectDirectory);
        if (url.origin !== projectDirectory.origin ||
            (!url.pathname.startsWith(projectDirectory.pathname) && url.href !== homePage.href)) {
            throw new Error(`Project path must point inside the Projects folder or to the site home page: ${project.link}`);
        }

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Could not load ${project.link} (${response.status}).`);
        }

        const page = new DOMParser().parseFromString(await response.text(), "text/html");
        const title = project.title
            || page.querySelector("h1")?.textContent?.trim()
            || page.title.trim()
            || project.link.split("/").pop();
        const status = projectStatuses.find(value =>
            value.toLocaleLowerCase() === project.status.toLocaleLowerCase()
        );

        return {
            url,
            title,
            status,
            description: project.description || page.querySelector("p")?.textContent?.trim() || "",
            searchText: `${project.title} ${project.description} ${status} ${page.title} ${page.body.textContent}`
        };
    }));

    isLoading = false;
    renderResults(searchInput.value);
}

document.getElementById("project-search").addEventListener("submit", event => {
    event.preventDefault();
    renderResults(searchInput.value);
});
searchInput.addEventListener("input", () => renderResults(searchInput.value));

loadProjects().catch(error => {
    isLoading = false;
    searchStatus.textContent = `Unable to load projects: ${error.message}`;
});
