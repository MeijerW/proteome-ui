(function () {
    var repoOwner = "MeijerW";
    var repoName = "proteome-ui";
    var endpoint = "https://api.github.com/repos/" + repoOwner + "/" + repoName + "/commits/main";

    function setFooterText(text) {
        var labels = document.querySelectorAll("[data-last-updated]");
        for (var i = 0; i < labels.length; i += 1) {
            labels[i].textContent = text;
        }
    }

    function formatDate(isoDate) {
        var parsed = new Date(isoDate);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }

        return new Intl.DateTimeFormat("en-GB", {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(parsed);
    }

    fetch(endpoint, {
        headers: {
            Accept: "application/vnd.github+json"
        }
    })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("GitHub API request failed");
            }
            return response.json();
        })
        .then(function (payload) {
            var commitDate = payload && payload.commit && payload.commit.committer && payload.commit.committer.date;
            var formatted = commitDate ? formatDate(commitDate) : null;
            if (!formatted) {
                setFooterText("Last updated: unavailable");
                return;
            }
            setFooterText("Last updated: " + formatted);
        })
        .catch(function () {
            setFooterText("Last updated: unavailable");
        });
})();
