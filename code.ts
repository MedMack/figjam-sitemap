// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for plugins. Code in this file has access to
// the *figma document* via the figma global object.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (See https://www.figma.com/plugin-docs/how-plugins-run).

// This shows the HTML page in "ui.html".
figma.showUI(__html__, { width: 300, height: 1000 });

interface PageInfo {
  url: string;
  title: string;
  depth: number;
  children: PageInfo[];
}

interface SitemapNode {
  url: string;
  depth: number;
  shape: FrameNode;
  parent: SitemapNode | null;
}

// Load fonts at the start of the plugin
const fontLoad = figma.loadFontAsync({ family: "Inter", style: "Regular" });

figma.ui.onmessage = async (msg: { type: string, json: string }) => {
  if (msg.type === 'create-sitemap') {
    console.log("Received JSON:", msg.json);

    try {
      // Ensure font is loaded before proceeding
      await fontLoad;

      const rootPage = JSON.parse(msg.json) as PageInfo;
      const nodes: SitemapNode[] = [];

      // Create nodes recursively
      await createSitemapNodesRecursive(rootPage, null, nodes);

      // Adjust horizontal spacing
      const maxDepth = Math.max(...nodes.map(n => n.depth));
      const horizontalSpacing = Math.max(250, 800 / (maxDepth + 1)); // Ensure minimum spacing
      nodes.forEach((node) => {
        node.shape.x = node.depth * horizontalSpacing;
      });

      // Adjust vertical spacing and shape width
      let maxWidth = 200;
      nodes.forEach((node) => {
        maxWidth = Math.max(maxWidth, node.shape.width);
      });

      // Resize all shapes to the maximum width
      nodes.forEach((node, index) => {
        node.shape.resize(maxWidth, node.shape.height);
        node.shape.y = index * 150; // Simple vertical spacing
      });

      // Create connections after layout is set
      for (const node of nodes) {
        if (node.parent) {
          createConnection(node.parent.shape, node.shape);
        }
      }

      const shapes = nodes.map(node => node.shape);
      figma.currentPage.selection = shapes;
      figma.viewport.scrollAndZoomIntoView(shapes);
      figma.ui.postMessage("Sitemap created successfully!");
    } catch (error) {
      console.error("Error processing sitemap:", error);
      figma.ui.postMessage(`Error creating sitemap: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
};

async function createSitemapNodesRecursive(page: PageInfo, parent: SitemapNode | null, nodes: SitemapNode[]): Promise<void> {
  const shape = await createSitemapNode(page);
  const node: SitemapNode = { url: page.url, depth: page.depth, shape, parent };
  nodes.push(node);

  for (const child of page.children) {
    await createSitemapNodesRecursive(child, node, nodes);
  }
}

async function createSitemapNode(page: PageInfo): Promise<FrameNode> {
  const frame = figma.createFrame();
  frame.resize(200, 100);
  frame.fills = [{ type: 'SOLID', color: { r: 1, g: 0.5, b: 0 } }];
  frame.cornerRadius = 8;

  const text = figma.createText();
  text.fontName = { family: "Inter", style: "Regular" };
  text.characters = page.title;
  text.fontSize = 10;

  frame.appendChild(text);

  // Center the text in the frame
  text.x = (frame.width - text.width) / 2;
  text.y = (frame.height - text.height) / 2;

  figma.currentPage.appendChild(frame);
  console.log("Node created for page:", page.title);
  
  return frame;
}

function createConnection(parent: FrameNode, child: FrameNode) {
  const line = figma.createLine();
  line.strokeWeight = 2;
  line.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];

  // Position the line from the right side of the parent to the left side of the child
  line.x = parent.x + parent.width;
  line.y = parent.y + parent.height / 2;
  
  // Set the length of the line, ensuring it's at least 0.01
  const lineLength = Math.max(0.01, child.x - (parent.x + parent.width));
  line.resize(lineLength, 0);

  figma.currentPage.appendChild(line);
}
