// 輪郭多角形を厚みのある板に押し出し、three.js の BufferGeometry JSON として書き出す
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** 小数点以下 digits 桁に丸める（JSON サイズ削減） */
const roundArray = (arr, digits) => {
  const f = 10 ** digits;
  return Array.from(arr, (v) => Math.round(v * f) / f);
};

/**
 * 外周（m 単位）から板のジオメトリを作る。板の中心が z=0、表が +Z。
 * groups: 0 = 表裏の面, 1 = 側面（ExtrudeGeometry と同じ）
 */
export function buildBoardGeometryJSON(points, { thicknessM, bevelM }) {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, p.y)));
  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessM,
    bevelEnabled: bevelM > 0,
    bevelThickness: bevelM,
    bevelSize: bevelM,
    bevelSegments: 2,
    curveSegments: 1,
  });
  extruded.translate(0, 0, -thicknessM / 2);

  // パラメータ形式ではなく頂点データとして保存するため、素の BufferGeometry にコピーする
  const plain = new THREE.BufferGeometry().copy(extruded);
  plain.deleteAttribute("uv"); // 板は単色なので UV 不要
  const indexed = mergeVertices(plain, 1e-5);
  indexed.computeBoundingSphere();

  const json = indexed.toJSON();
  delete json.uuid; // ビルドのたびに変わるランダム ID。出力を毎回同じにするため除く
  const { attributes, index } = json.data;
  attributes.position.array = roundArray(attributes.position.array, 4);
  attributes.normal.array = roundArray(attributes.normal.array, 3);
  return { json, vertexCount: indexed.attributes.position.count, triangleCount: index.array.length / 3 };
}
