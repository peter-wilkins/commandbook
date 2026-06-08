# Blog Writing Command

`write_and_publish_blog_post` turns messy source material into a draftable blog
run.

Intent grill slice:

```bash
commandbook write_and_publish_blog_post \
  --site continuumkit \
  --seed https://chatgpt.com/share/6a270942-0168-8326-9371-7a98ba67450e \
  --dry-run
```

The command currently:

1. loads the target site's editorial profile
2. consumes the seed from a URL, file path, or inline text
3. extracts readable seed material where possible
4. pauses for a Blog Intent Grill before drafting, unless `--intent-file`
   already supplies the resolved answers
5. writes a draft Markdown post when `--intent-file` and `--blog-repo` or
   `--output` are provided

It does not publish yet.

Draft slice:

```bash
commandbook write_and_publish_blog_post \
  --site continuumkit \
  --seed https://chatgpt.com/share/6a270942-0168-8326-9371-7a98ba67450e \
  --intent-file sites/continuumkit/blog-intents/hickey-decomplex-public.json \
  --blog-repo /home/peter/workflow-manager/continuumkit-blog
```

`--blog-repo` writes to:

```text
<blog-repo>/src/content/posts/<intent-slug>.md
```

Use `--output <file.md>` for an exact path. Existing files are not overwritten
unless `--overwrite` is supplied.

## Blog Intent Grill

Before drafting, the run asks:

1. Who is this for?
2. What should readers understand or feel by the end?
3. What kind of post is this?
4. What source or evidence must be used?
5. What mood and style should it have?
6. Is anything sensitive or not for publication?

The site profile supplies defaults, but the human can override them.

Resolved answers can be saved as JSON and passed with `--intent-file`. The file
is intentionally plain content, not a new schema yet. Add structure only when
several posts prove the shape is stable.

## Capability Placeholder

Writing a post requires a text-generation agent. Publishing requires a deployer
with access to the target site.

For now these are setup expectations, not enforced security boundaries. The
runner stays in trusted local YOLO mode until there is a broker/sandbox/approval
path with tests proving it blocks unapproved side effects.

The current draft writer is deliberately small and seed-aware. It can produce
the first public-safe Hickey/de-complect draft and a generic scaffold for other
topics. A future text-generation capability can replace this operation once the
intent file and publish loop have proven useful.
