// @flow

import {parse} from "./parser";
import exampleRepoData from "./demoData/example-repo.json";
import {Repository, Issue, PullRequest, Comment, Author} from "./api";
import {
  AUTHOR_NODE_TYPE,
  COMMENT_NODE_TYPE,
  ISSUE_NODE_TYPE,
  PULL_REQUEST_NODE_TYPE,
} from "./types";
describe("GitHub porcelain API", () => {
  const graph = parse("sourcecred/example-repo", exampleRepoData);
  const repo = new Repository("sourcecred/example-repo", graph);
  function issueOrPRByNumber(n: number): Issue | PullRequest {
    const result = repo.issueOrPRByNumber(n);
    if (result == null) {
      throw new Error(`Expected Issue/PR ${n} to exist`);
    }
    return result;
  }
  describe("has wrappers for", () => {
    it("Issues", () => {
      const issue = issueOrPRByNumber(1);
      expect(issue.title()).toBe("An example issue.");
      expect(issue.body()).toBe("This is just an example issue.");
      expect(issue.number()).toBe(1);
      expect(issue.type()).toBe(ISSUE_NODE_TYPE);
      expect(issue.url()).toBe(
        "https://github.com/sourcecred/example-repo/issues/1"
      );
      expect(issue.node()).toMatchSnapshot();
      expect(issue.address()).toEqual(issue.node().address);
      expect(issue.authors().map((x) => x.login())).toEqual(["decentralion"]);
    });

    it("PullRequests", () => {
      const pullRequest = issueOrPRByNumber(3);
      expect(pullRequest.body()).toBe("Oh look, it's a pull request.");
      expect(pullRequest.title()).toBe("Add README, merge via PR.");
      expect(pullRequest.url()).toBe(
        "https://github.com/sourcecred/example-repo/pull/3"
      );
      expect(pullRequest.number()).toBe(3);
      expect(pullRequest.type()).toBe(PULL_REQUEST_NODE_TYPE);
      expect(pullRequest.node()).toMatchSnapshot();
      expect(pullRequest.address()).toEqual(pullRequest.node().address);
    });

    it("Pull Request Reviews", () => {
      const pr = PullRequest.from(issueOrPRByNumber(5));
      const reviews = pr.reviews();
      expect(reviews).toHaveLength(2);
      expect(reviews[0].state()).toBe("CHANGES_REQUESTED");
      expect(reviews[1].state()).toBe("APPROVED");
    });

    it("Pull Request Review Comments", () => {
      const pr = PullRequest.from(issueOrPRByNumber(5));
      const reviews = pr.reviews();
      expect(reviews).toHaveLength(2);
      const comments = reviews[0].comments();
      expect(comments).toHaveLength(1);
      const comment = comments[0];
      expect(comment.url()).toBe(
        "https://github.com/sourcecred/example-repo/pull/5#discussion_r171460198"
      );
      expect(comment.body()).toBe("seems a bit capricious");
      expect(comment.authors().map((a) => a.login())).toEqual(["wchargin"]);
    });

    it("Comments", () => {
      const issue = issueOrPRByNumber(6);
      const comments = issue.comments();
      expect(comments.length).toMatchSnapshot();
      const comment = comments[0];
      expect(comment.type()).toBe(COMMENT_NODE_TYPE);
      expect(comment.body()).toBe("A wild COMMENT appeared!");
      expect(comment.url()).toBe(
        "https://github.com/sourcecred/example-repo/issues/6#issuecomment-373768442"
      );
      expect(comment.node()).toMatchSnapshot();
      expect(comment.address()).toEqual(comment.node().address);
      expect(comment.authors().map((x) => x.login())).toEqual(["decentralion"]);
    });

    it("Authors", () => {
      const authors = repo.authors();
      // So we don't need to manually update the test if a new person posts
      expect(authors.length).toMatchSnapshot();

      const decentralion = authors.find((x) => x.login() === "decentralion");
      if (decentralion == null) {
        throw new Error("Who let the lions out?");
      }
      expect(decentralion.url()).toBe("https://github.com/decentralion");
      expect(decentralion.type()).toBe(AUTHOR_NODE_TYPE);
      expect(decentralion.subtype()).toBe("USER");
      expect(decentralion.node()).toMatchSnapshot();
      expect(decentralion.address()).toEqual(decentralion.node().address);
    });
  });

  describe("has type coercion that", () => {
    it("allows refining types when correct", () => {
      const _unused_issue: Issue = Issue.from(issueOrPRByNumber(1));
      const _unused_pr: PullRequest = PullRequest.from(issueOrPRByNumber(3));
      const _unused_author: Author = Author.from(
        issueOrPRByNumber(3).authors()[0]
      );
      const _unused_comment: Comment = Comment.from(
        issueOrPRByNumber(2).comments()[0]
      );
    });
    it("throws an error on bad type refinement", () => {
      expect(() => PullRequest.from(issueOrPRByNumber(1))).toThrowError(
        "to have type PULL_REQUEST"
      );
      expect(() => Issue.from(issueOrPRByNumber(3))).toThrowError(
        "to have type ISSUE"
      );
      expect(() =>
        Comment.from(issueOrPRByNumber(3).authors()[0])
      ).toThrowError("to have type COMMENT");
      expect(() =>
        Author.from(issueOrPRByNumber(2).comments()[0])
      ).toThrowError("to have type AUTHOR");
    });
  });
});
