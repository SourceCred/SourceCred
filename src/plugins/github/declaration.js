// @flow

import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import * as N from "./nodes";
import * as E from "./edges";
import dedent from "../../util/dedent";

const repoNodeType = Object.freeze({
  name: "Repository",
  pluralName: "Repositories",
  prefix: N.Prefix.repo,
  defaultWeight: 4,
  description: "NodeType for a GitHub repository",
});

const issueNodeType = Object.freeze({
  name: "Issue",
  pluralName: "Issues",
  prefix: N.Prefix.issue,
  defaultWeight: 2,
  description: "NodeType for a GitHub issue",
});

const pullNodeType = Object.freeze({
  name: "Pull request",
  pluralName: "Pull requests",
  prefix: N.Prefix.pull,
  defaultWeight: 4,
  description: "NodeType for a GitHub pull request",
});

const reviewNodeType = Object.freeze({
  name: "Pull request review",
  pluralName: "Pull request reviews",
  prefix: N.Prefix.review,
  defaultWeight: 1,
  description: "NodeType for a GitHub code review",
});

const commentNodeType = Object.freeze({
  name: "Comment",
  pluralName: "Comments",
  prefix: N.Prefix.comment,
  defaultWeight: 1,
  description: "NodeType for a GitHub comment",
});

const commitNodeType = Object.freeze({
  name: "Commit",
  pluralName: "Commits",
  prefix: N.Prefix.commit,
  defaultWeight: 1,
  description:
    "Represents a particular Git commit on GitHub, i.e. scoped to a particular repository",
});

export const userNodeType = Object.freeze({
  name: "User",
  pluralName: "Users",
  prefix: N.Prefix.user,
  defaultWeight: 1,
  description: "NodeType for a GitHub user",
});

const botNodeType = Object.freeze({
  name: "Bot",
  pluralName: "Bots",
  prefix: N.Prefix.bot,
  defaultWeight: 0.25,
  description: "NodeType for a GitHub bot account",
});

const nodeTypes = Object.freeze([
  repoNodeType,
  issueNodeType,
  pullNodeType,
  reviewNodeType,
  commentNodeType,
  commitNodeType,
  userNodeType,
  botNodeType,
]);

const authorsEdgeType = Object.freeze({
  forwardName: "authors",
  backwardName: "is authored by",
  defaultWeight: {forwards: 1 / 2, backwards: 1},
  prefix: E.Prefix.authors,
  description: dedent`\
    Connects a GitHub account to a post that they authored.

    Examples of posts include issues, pull requests, and comments.
  `,
});

const hasParentEdgeType = Object.freeze({
  forwardName: "has parent",
  backwardName: "has child",
  defaultWeight: {forwards: 1, backwards: 1 / 4},
  prefix: E.Prefix.hasParent,
  description: dedent`\
    Connects a GitHub entity to its child entities.

    For example, a Repository has Issues and Pull Requests as children, and a
    Pull Request has comments and reviews as children.
  `,
});

const mergedAsEdgeType = Object.freeze({
  forwardName: "merges",
  backwardName: "is merged by",
  defaultWeight: {forwards: 1 / 2, backwards: 1},
  prefix: E.Prefix.mergedAs,
  description: dedent`\
    Connects a GitHub pull request to the Git commit that it merges.
  `,
});

const referencesEdgeType = Object.freeze({
  forwardName: "references",
  backwardName: "is referenced by",
  defaultWeight: {forwards: 1, backwards: 0},
  prefix: E.Prefix.references,
  description: dedent`\
    Connects a GitHub post to an entity that it references.

    For example, if you write a GitHub issue comment that says "thanks
    @username for pull #1337", it will create references edges to both the user
    @username, and to pull #1337 in the same repository.
  `,
});

const reactsHeartEdgeType = Object.freeze({
  forwardName: "reacted ❤️ to",
  backwardName: "got ❤️ from",
  defaultWeight: {forwards: 2, backwards: 0},
  prefix: E.Prefix.reactsHeart,
  description: dedent`\
    Connects users to posts to which they gave a ❤️ reaction.
  `,
});

const reactsThumbsUpEdgeType = Object.freeze({
  forwardName: "reacted 👍 to",
  backwardName: "got 👍 from",
  defaultWeight: {forwards: 1, backwards: 0},
  prefix: E.Prefix.reactsThumbsUp,
  description: dedent`\
    Connects users to posts to which they gave a 👍 reaction.
  `,
});

const reactsHoorayEdgeType = Object.freeze({
  forwardName: "reacted 🎉 to",
  backwardName: "got 🎉 from",
  defaultWeight: {forwards: 4, backwards: 0},
  prefix: E.Prefix.reactsHooray,
  description: dedent`\
    Connects users to posts to which they gave a 🎉 reaction.
  `,
});

const reactsRocketEdgeType = Object.freeze({
  forwardName: "reacted 🚀 to",
  backwardName: "got 🚀 from",
  defaultWeight: {forwards: 1, backwards: 0},
  prefix: E.Prefix.reactsRocket,
  description: dedent`\
    Connects users to posts to which they gave a 🚀 reaction.
  `,
});

const correspondsToCommitEdgeType = Object.freeze({
  forwardName: "corresponds to Git commit",
  backwardName: "merged on GitHub as",
  defaultWeight: {forwards: 1, backwards: 1},
  prefix: E.Prefix.correspondsToCommit,
  description: dedent`\
    Connects a commit on GitHub to the corresponding raw Git commit.
  `,
});

const edgeTypes = Object.freeze([
  authorsEdgeType,
  hasParentEdgeType,
  mergedAsEdgeType,
  referencesEdgeType,
  reactsThumbsUpEdgeType,
  reactsHeartEdgeType,
  reactsHoorayEdgeType,
  reactsRocketEdgeType,
  correspondsToCommitEdgeType,
]);

export const declaration: PluginDeclaration = Object.freeze({
  name: "GitHub",
  nodePrefix: N.Prefix.base,
  edgePrefix: E.Prefix.base,
  nodeTypes: nodeTypes,
  edgeTypes: edgeTypes,
});
