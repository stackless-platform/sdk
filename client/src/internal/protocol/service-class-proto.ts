// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { ServiceMethodProto } from './service-method-proto.js';


export class ServiceClassProto {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):ServiceClassProto {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsServiceClassProto(bb:flatbuffers.ByteBuffer, obj?:ServiceClassProto):ServiceClassProto {
  return (obj || new ServiceClassProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsServiceClassProto(bb:flatbuffers.ByteBuffer, obj?:ServiceClassProto):ServiceClassProto {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new ServiceClassProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

classId():number {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.readUint16(this.bb_pos + offset) : 0;
}

className():string|null
className(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
className(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

fileNameId():number {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.readUint16(this.bb_pos + offset) : 0;
}

methods(index: number, obj?:ServiceMethodProto):ServiceMethodProto|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? (obj || new ServiceMethodProto()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
}

methodsLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

static startServiceClassProto(builder:flatbuffers.Builder) {
  builder.startObject(4);
}

static addClassId(builder:flatbuffers.Builder, classId:number) {
  builder.addFieldInt16(0, classId, 0);
}

static addClassName(builder:flatbuffers.Builder, classNameOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, classNameOffset, 0);
}

static addFileNameId(builder:flatbuffers.Builder, fileNameId:number) {
  builder.addFieldInt16(2, fileNameId, 0);
}

static addMethods(builder:flatbuffers.Builder, methodsOffset:flatbuffers.Offset) {
  builder.addFieldOffset(3, methodsOffset, 0);
}

static createMethodsVector(builder:flatbuffers.Builder, data:flatbuffers.Offset[]):flatbuffers.Offset {
  builder.startVector(4, data.length, 4);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addOffset(data[i]!);
  }
  return builder.endVector();
}

static startMethodsVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(4, numElems, 4);
}

static endServiceClassProto(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  builder.requiredField(offset, 6) // class_name
  builder.requiredField(offset, 10) // methods
  return offset;
}

static createServiceClassProto(builder:flatbuffers.Builder, classId:number, classNameOffset:flatbuffers.Offset, fileNameId:number, methodsOffset:flatbuffers.Offset):flatbuffers.Offset {
  ServiceClassProto.startServiceClassProto(builder);
  ServiceClassProto.addClassId(builder, classId);
  ServiceClassProto.addClassName(builder, classNameOffset);
  ServiceClassProto.addFileNameId(builder, fileNameId);
  ServiceClassProto.addMethods(builder, methodsOffset);
  return ServiceClassProto.endServiceClassProto(builder);
}
}
