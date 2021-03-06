// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

export class MethodArgumentProto {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):MethodArgumentProto {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsMethodArgumentProto(bb:flatbuffers.ByteBuffer, obj?:MethodArgumentProto):MethodArgumentProto {
  return (obj || new MethodArgumentProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsMethodArgumentProto(bb:flatbuffers.ByteBuffer, obj?:MethodArgumentProto):MethodArgumentProto {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new MethodArgumentProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

name():string|null
name(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
name(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

type():string|null
type(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
type(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

static startMethodArgumentProto(builder:flatbuffers.Builder) {
  builder.startObject(2);
}

static addName(builder:flatbuffers.Builder, nameOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, nameOffset, 0);
}

static addType(builder:flatbuffers.Builder, typeOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, typeOffset, 0);
}

static endMethodArgumentProto(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  builder.requiredField(offset, 4) // name
  builder.requiredField(offset, 6) // type
  return offset;
}

static createMethodArgumentProto(builder:flatbuffers.Builder, nameOffset:flatbuffers.Offset, typeOffset:flatbuffers.Offset):flatbuffers.Offset {
  MethodArgumentProto.startMethodArgumentProto(builder);
  MethodArgumentProto.addName(builder, nameOffset);
  MethodArgumentProto.addType(builder, typeOffset);
  return MethodArgumentProto.endMethodArgumentProto(builder);
}
}
