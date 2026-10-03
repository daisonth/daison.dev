<script lang="ts">
  import FormatterTool from "./FormatterTool.svelte";
  import { formatXml, minifyXml, validateXml, buildXmlTree } from "../../lib/formatters/xml";
</script>

<FormatterTool
  label="XML"
  placeholder={"Paste XML here…"}
  format={formatXml}
  minify={minifyXml}
  validate={validateXml}
  buildTree={buildXmlTree}
/>
