// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { DataReferenceValueProto } from './data-reference-value-proto.js';


export class SubscribeDataUpdatesRequestProto {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):SubscribeDataUpdatesRequestProto {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsSubscribeDataUpdatesRequestProto(bb:flatbuffers.ByteBuffer, obj?:SubscribeDataUpdatesRequestProto):SubscribeDataUpdatesRequestProto {
  return (obj || new SubscribeDataUpdatesRequestProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsSubscribeDataUpdatesRequestProto(bb:flatbuffers.ByteBuffer, obj?:SubscribeDataUpdatesRequestProto):SubscribeDataUpdatesRequestProto {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new SubscribeDataUpdatesRequestProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

references(index: number, obj?:DataReferenceValueProto):DataReferenceValueProto|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? (obj || new DataReferenceValueProto()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
}

referencesLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

static startSubscribeDataUpdatesRequestProto(builder:flatbuffers.Builder) {
  builder.startObject(1);
}

static addReferences(builder:flatbuffers.Builder, referencesOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, referencesOffset, 0);
}

static createReferencesVector(builder:flatbuffers.Builder, data:flatbuffers.Offset[]):flatbuffers.Offset {
  builder.startVector(4, data.length, 4);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addOffset(data[i]!);
  }
  return builder.endVector();
}

static startReferencesVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(4, numElems, 4);
}

static endSubscribeDataUpdatesRequestProto(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  builder.requiredField(offset, 4) // references
  return offset;
}

static createSubscribeDataUpdatesRequestProto(builder:flatbuffers.Builder, referencesOffset:flatbuffers.Offset):flatbuffers.Offset {
  SubscribeDataUpdatesRequestProto.startSubscribeDataUpdatesRequestProto(builder);
  SubscribeDataUpdatesRequestProto.addReferences(builder, referencesOffset);
  return SubscribeDataUpdatesRequestProto.endSubscribeDataUpdatesRequestProto(builder);
}
}
