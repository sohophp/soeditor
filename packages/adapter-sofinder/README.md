# @soeditor/adapter-sofinder

Dependency-free adapters from application-provided SoFinder picker and upload
tasks to SoEditor's generic `FileManager` and `UploadService` capabilities. The
host owns the concrete SoFinder SDK/UI integration; no SoFinder runtime is
pulled into SoEditor.

```ts
import {
    SoFinderAdapter,
    SoFinderUploadAdapter,
} from '@soeditor/adapter-sofinder';

const picker = new SoFinderAdapter({ pick: (request) => host.pick(request) });
const uploads = new SoFinderUploadAdapter({
    upload: (request) => host.upload(request),
});
```

The upload callback returns a cancellable task with a `completion` promise and
0–100 progress snapshots. Both adapters validate the final URL and metadata
before generic editor commands can mutate canonical HTML.
Hosts may map stable SoFinder asset identities and generated variants to the
optional `assetId`, `srcset`, and `sizes` fields. They remain ordinary canonical
HTML attributes and do not introduce SoFinder-specific projection classes.
