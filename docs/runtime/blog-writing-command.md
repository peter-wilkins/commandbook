# Blog Writing Command

`write_and_publish_blog_post` turns messy source material into a draftable blog
run.

First slice:

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
4. pauses for a Blog Intent Grill before drafting

It does not publish yet.

## Blog Intent Grill

Before drafting, the run asks:

1. Who is this for?
2. What should readers understand or feel by the end?
3. What kind of post is this?
4. What source or evidence must be used?
5. What mood and style should it have?
6. Is anything sensitive or not for publication?

The site profile supplies defaults, but the human can override them.

## Capability Placeholder

Writing a post requires a text-generation agent. Publishing requires a deployer
with access to the target site.

For now these are setup expectations, not enforced security boundaries. The
runner stays in trusted local YOLO mode until there is a broker/sandbox/approval
path with tests proving it blocks unapproved side effects.
