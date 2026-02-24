export async function fetchProfile(username) {
  try {
    const resp = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile {
                userAvatar
                ranking
              }
              submitStatsGlobal {
                acSubmissionNum {
                  difficulty
                  count
                }
              }
            }
            userContestRanking(username: $username) {
              rating
              attendedContestsCount
            }
          }
        `,
        variables: { username },
      }),
    });

    const json = await resp.json();
    console.log("GraphQL response:", json);

    if (!json.data?.matchedUser) return null;

    // Merge both into single object
    return {
      ...json.data.matchedUser,
      userContestRanking: json.data.userContestRanking,
    };
  } catch (err) {
    console.error("Profile fetch failed:", err);
    return null;
  }
}
