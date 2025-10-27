// js/skin_adapter_example.js
// Example of wiring producers inside your skin startup (ESM style).

import { createP5Producer } from './producers/p5_producer.js';
import { createThreeProducer } from './producers/three_producer.js';

export function attachProducersToSkin(setup) {
  // 'setup' is an object with { onResize, uploadSource, setProducerGetter }
  let producer = createP5Producer();
  producer.start();

  function setProducer(kind) {
    producer.stop();
    producer = (kind === 'three') ? createThreeProducer() : createP5Producer();
    producer.start();
    setup.onResize(); // ensure sizes are synced
  }

  // exposed to console
  window.PFIIIVE = {
    useP5: () => setProducer('p5'),
    useThree: () => setProducer('three'),
  };

  // forward upload call to skin:
  setup.setProducerGetter(() => producer.getCanvas());
}
