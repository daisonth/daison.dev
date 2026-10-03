<script lang="ts">
  import FormatterTool from "./FormatterTool.svelte";
  import { formatJson, minifyJson, validateJson, buildJsonTree } from "../../lib/formatters/json";
</script>

<FormatterTool
  label="JSON"
  placeholder={"Paste JSON here…"}
  format={formatJson}
  minify={minifyJson}
  validate={validateJson}
  buildTree={buildJsonTree}
/>
