<p align="center">
  <a aria-label="Join the community on Slack" href="https://community.supernova.io"><img alt="" src="https://img.shields.io/badge/Join%20the%20community-black.svg?style=for-the-badge&logo=Slack"></a>
  <a aria-label="Follow Supernova on Twitter" href="https://twitter.com/supernova_io"><img alt="" src="https://img.shields.io/badge/Follow%20@supernova-black.svg?style=for-the-badge&logo=Twitter"></a>
</p>

[Supernova](https://supernova.io/) makes generation and delivery of production code from your design systems a breeze. In this repository, you'll find all available exporters—packages that control how code is exported to your codebase. For tutorials on working with these exporters, or even building your own, consult our [developer docs](https://developers.supernova.io).

![Header Image](./images/exporters.png)

## Getting Started

Here are a few resources to help you get started:

- Watch the ["Building Exporters (deep dive)" video](https://www.youtube.com/watch?v=4BvoWLPbOMo&ab_channel=Supernova) to learn how to use, create, and modify exporters so they work exactly how you need them to!
- Read our [developer documentation](https://developers.supernova.io) for any additional details you might need
- Learn by example by exploring the exporters [we've built for you](./exporters)
- Join our [Slack community](https://community.supernova.io/) to discuss any topics with the Supernova team and other developers

## Cobalt token export (TeamViewer)

The **[Tailwind CSS 4 exporter](./exporters/tailwind-4)** is configured to export TeamViewer's Cobalt design tokens. It names tokens by their Figma WEB code syntax (`--cb-*`), writes component tokens to a separate `components.css`, and validates the output against the Cobalt token rules.

- **[Handoff guide](./exporters/tailwind-4/HANDOFF.md)** — recommended Supernova settings, the files produced, and the build-failure rules.
- **[Exporter README](./exporters/tailwind-4/README.md#cobalt-token-export)** — full configuration reference.

## Help Us Build a Better Product

If you have:

- Suggestions for improving the developer experience
- Encountered any bugs
- Found unclear or incorrect information in the documentation

or you'd like to contribute with your own helper please open a new [GitHub issue](https://github.com/Supernova-Studio/exporters/issues/new/choose). You can also share your thoughts through our community channels.

## Community

We have an active [Slack community](https://community.supernova.io) where both the Supernova team and your fellow developers exchange ideas and engage in discussions. Come join us to shape the future of design systems and automatic code delivery!
