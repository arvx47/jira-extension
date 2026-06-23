const input = document.getElementById("jiraBase");
const status = document.getElementById("status");

chrome.storage.sync.get("jiraBase", ({ jiraBase }) => {
  if (jiraBase) input.value = jiraBase;
});

document.getElementById("save").addEventListener("click", () => {
  const val = input.value.trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  chrome.storage.sync.set({ jiraBase: val }, () => {
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
