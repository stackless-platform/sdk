// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { ConstructorProto } from './constructor-proto.js';
import { MethodProto } from './method-proto.js';


export class FreeClassProto {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
__init(i:number, bb:flatbuffers.ByteBuffer):FreeClassProto {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsFreeClassProto(bb:flatbuffers.ByteBuffer, obj?:FreeClassProto):FreeClassProto {
  return (obj || new FreeClassProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsFreeClassProto(bb:flatbuffers.ByteBuffer, obj?:FreeClassProto):FreeClassProto {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new FreeClassProto()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

ctor(obj?:ConstructorProto):ConstructorProto|null {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? (obj || new ConstructorProto()).__init(this.bb!.__indirect(this.bb_pos + offset), this.bb!) : null;
}

sourceCode():string|null
sourceCode(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
sourceCode(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

className():string|null
className(optionalEncoding:flatbuffers.Encoding):string|Uint8Array|null
className(optionalEncoding?:any):string|Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.__string(this.bb_pos + offset, optionalEncoding) : null;
}

methods(index: number, obj?:MethodProto):MethodProto|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? (obj || new MethodProto()).__init(this.bb!.__indirect(this.bb!.__vector(this.bb_pos + offset) + index * 4), this.bb!) : null;
}

methodsLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

static startFreeClassProto(builder:flatbuffers.Builder) {
  builder.startObject(4);
}

static addCtor(builder:flatbuffers.Builder, ctorOffset:flatbuffers.Offset) {
  builder.addFieldOffset(0, ctorOffset, 0);
}

static addSourceCode(builder:flatbuffers.Builder, sourceCodeOffset:flatbuffers.Offset) {
  builder.addFieldOffset(1, sourceCodeOffset, 0);
}

static addClassName(builder:flatbuffers.Builder, classNameOffset:flatbuffers.Offset) {
  builder.addFieldOffset(2, classNameOffset, 0);
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

static endFreeClassProto(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  builder.requiredField(offset, 4) // ctor
  builder.requiredField(offset, 6) // source_code
  return offset;
}

static createFreeClassProto(builder:flatbuffers.Builder, ctorOffset:flatbuffers.Offset, sourceCodeOffset:flatbuffers.Offset, classNameOffset:flatbuffers.Offset, methodsOffset:flatbuffers.Offset):flatbuffers.Offset {
  FreeClassProto.startFreeClassProto(builder);
  FreeClassProto.addCtor(builder, ctorOffset);
  FreeClassProto.addSourceCode(builder, sourceCodeOffset);
  FreeClassProto.addClassName(builder, classNameOffset);
  FreeClassProto.addMethods(builder, methodsOffset);
  return FreeClassProto.endFreeClassProto(builder);
}
}