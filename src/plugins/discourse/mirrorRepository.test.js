// @flow

import Database from "better-sqlite3";
import fs from "fs";
import tmp from "tmp";
import {SqliteMirrorRepository} from "./mirrorRepository";
import type {Topic, Post, TopicWithPosts} from "./fetch";

describe("plugins/discourse/mirrorRepository", () => {
  it("rejects a different server url without changing the database", () => {
    // We use an on-disk database file here so that we can dump the
    // contents to ensure that the database is physically unchanged.
    const filename = tmp.fileSync().name;
    const db = new Database(filename);
    const url1 = "https://foo.bar";
    const url2 = "https://foo.zod";
    expect(() => new SqliteMirrorRepository(db, url1)).not.toThrow();
    const data = fs.readFileSync(filename).toJSON();

    expect(() => new SqliteMirrorRepository(db, url2)).toThrow(
      "incompatible server or version"
    );
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);

    expect(() => new SqliteMirrorRepository(db, url1)).not.toThrow();
    expect(fs.readFileSync(filename).toJSON()).toEqual(data);
  });

  it("replaceTopicTransaction finds and prunes old posts", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456789,
      authorUsername: "credbot",
    };
    const p1: Post = {
      id: 100,
      topicId: 123,
      indexWithinTopic: 0,
      replyToPostIndex: null,
      timestampMs: 456789,
      authorUsername: "credbot",
      cooked: "<p>Valid post</p>",
    };
    const p2: Post = {
      id: 101,
      topicId: 123,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 456789,
      authorUsername: "credbot",
      cooked: "<p>Follow up 1</p>",
    };
    const p3: Post = {
      id: 102,
      topicId: 123,
      indexWithinTopic: 1,
      replyToPostIndex: null,
      timestampMs: 456789,
      authorUsername: "credbot",
      cooked: "<p>Follow up, replacement</p>",
    };
    const earlyTopic: TopicWithPosts = {topic, posts: [p1, p2]};
    const laterTopic: TopicWithPosts = {topic, posts: [p1, p3]};

    // When
    repository.replaceTopicTransaction(earlyTopic);
    repository.replaceTopicTransaction(laterTopic);
    const topics = repository.topics();
    const posts = repository.posts();

    // Then
    expect(topics).toEqual([topic]);
    expect(posts).toEqual([p1, p3]);
  });

  it("throws and rolls back a replaceTopicTransaction error", () => {
    // Given
    const db = new Database(":memory:");
    const url = "http://example.com";
    const repository = new SqliteMirrorRepository(db, url);
    const topic: Topic = {
      id: 123,
      categoryId: 1,
      title: "Sample topic",
      timestampMs: 456789,
      bumpedMs: 456789,
      authorUsername: "credbot",
    };
    const posts: Post[] = [
      {
        id: 456,
        topicId: 123,
        indexWithinTopic: 0,
        replyToPostIndex: null,
        timestampMs: 456789,
        authorUsername: "credbot",
        cooked: "<p>Valid post</p>",
      },
      {
        id: 456,
        topicId: 666,
        indexWithinTopic: 0,
        replyToPostIndex: null,
        timestampMs: 456789,
        authorUsername: "credbot",
        cooked: "<p>Invalid post, topic ID foreign key constraint.</p>",
      },
    ];
    const topicWithPosts: TopicWithPosts = {topic, posts};

    // When
    let error: Error | null = null;
    try {
      repository.replaceTopicTransaction(topicWithPosts);
    } catch (e) {
      error = e;
    }
    const actualTopics = repository.topics();
    const actualPosts = repository.posts();

    // Then
    expect(actualTopics).toEqual([]);
    expect(actualPosts).toEqual([]);
    expect(() => {
      if (error) throw error;
    }).toThrow("FOREIGN KEY constraint failed");
  });
});
